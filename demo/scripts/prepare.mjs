import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import sharp from "sharp";
import kebabcase from "lodash.kebabcase";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";

const root = fileURLToPath(new URL("../../", import.meta.url));
const demo = path.join(root, "demo");
const origin = "https://allthingssabine.com";
function safeHtml() {
  return tree => {
    function walk(node) {
      if (!node.children) return;
      node.children = node.children.filter(child => {
        if (
          ["script", "style", "form", "object", "embed"].includes(child.tagName)
        )
          return false;
        if (
          child.tagName === "iframe" &&
          !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//.test(
            child.properties?.src || ""
          )
        )
          return false;
        if (child.properties)
          for (const key of Object.keys(child.properties)) {
            if (
              /^on/i.test(key) ||
              key === "style" ||
              (["href", "src"].includes(key) &&
                /^\s*(javascript|data):/i.test(child.properties[key]))
            )
              delete child.properties[key];
          }
        walk(child);
        return true;
      });
    }
    walk(tree);
  };
}
const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(safeHtml)
  .use(rehypeStringify);
const imageCache = new Map();
await fs.mkdir(path.join(demo, "src/data"), { recursive: true });
await fs.mkdir(path.join(demo, "public/data"), { recursive: true });
await fs.mkdir(path.join(demo, "public/images/stories"), { recursive: true });

async function imageFor(src) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  const name = path.basename(src);
  if (imageCache.has(name)) return imageCache.get(name);
  let input = src.startsWith("/assets/")
    ? path.join(root, "public", src)
    : path.join(root, "src/assets/images", name);
  try {
    await fs.access(input);
  } catch {
    const fullSize = input.replace(/-\d+x\d+(?=\.[^.]+$)/, "");
    await fs.access(fullSize);
    input = fullSize;
  }
  const outputName = name.replace(/\.[^.]+$/, "") + ".webp";
  const output = path.join(demo, "public/images/stories", outputName);
  try {
    await fs.access(output);
  } catch {
    try {
      await sharp(input)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(output);
    } catch (error) {
      throw new Error(`Cannot prepare story image ${src}: ${error.message}`);
    }
  }
  const url = "/images/stories/" + outputName;
  imageCache.set(name, url);
  return url;
}

const stories = [];
for (const file of (
  await fs.readdir(path.join(root, "src/content/blog"))
).filter(f => f.endsWith(".md"))) {
  const { data, content } = matter(
    await fs.readFile(path.join(root, "src/content/blog", file), "utf8")
  );
  if (data.draft || new Date(data.pubDatetime) > new Date()) continue;
  let body = content;
  const references = [
    ...new Set(body.match(/@assets\/images\/[^)\s]+/g) || []),
  ];
  for (const ref of references)
    body = body.replaceAll(ref, await imageFor(ref));
  for (const ref of new Set(
    body.match(
      /https?:\/\/(?:www\.)?allthingssabine\.com\/wp-content\/uploads\/[^)\s]+/g
    ) || []
  )) {
    body = body.replaceAll(
      ref,
      await imageFor("@assets/images/" + path.basename(ref))
    );
  }
  const image = await imageFor(data.ogImage || references[0]);
  const slug = kebabcase(data.title);
  const tags = (data.tags || []).filter(t => t !== "others");
  stories.push({
    slug,
    title: data.title,
    description: data.description,
    date: new Date(data.pubDatetime).toISOString(),
    tags,
    image,
    href: `/stories/${slug}/`,
    html: String(await processor.process(body)),
    author: data.author ?? "Shannon Hall",
  });
}
stories.sort((a, b) => b.date.localeCompare(a.date));
const archive = [];
for (const file of (
  await fs.readdir(path.join(root, "content/facebook-archive"))
).filter(f => f.endsWith(".md"))) {
  const { data, content } = matter(
    await fs.readFile(path.join(root, "content/facebook-archive", file), "utf8")
  );
  if (data.draft !== false) continue;
  const media = (data.media || []).map(m => ({
    ...m,
    src: new URL(m.src, origin).href,
  }));
  const slug = file.replace(/\.md$/, "");
  archive.push({
    slug,
    title: data.title,
    description: data.description,
    date: new Date(data.publishedAt).toISOString(),
    historicalDate: data.historicalDate || "",
    tags: data.tags || [],
    image: media[0]?.src || "",
    media,
    href: `/time-capsule/${slug}/`,
    html: String(await processor.process(content)),
    video: data.video || null,
  });
}
archive.sort((a, b) => b.date.localeCompare(a.date));
await fs.writeFile(
  path.join(demo, "src/data/content.json"),
  JSON.stringify({ stories, archive })
);
for (const [name, items] of [
  ["stories", stories.filter(story => !story.tags.some(tag => tag.toLowerCase() === "news"))],
  ["archive", archive],
]) {
  await fs.writeFile(
    path.join(demo, `public/data/${name}.json`),
    JSON.stringify(items.map(({ html, media, video, ...item }) => item))
  );
}
await imageFor("/assets/cropped-fullmoontrainnew.jpg");
console.log(
  `Prepared ${stories.length} stories, ${archive.length} archive entries, and ${imageCache.size} optimized story images.`
);
