import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const archiveRoot = path.join(projectRoot, "data/facebook-import");
const postsPath = path.join(
  archiveRoot,
  "extracted/export-viUXWXE3/this_profile's_activity_across_facebook/posts/profile_posts_1.json"
);
const imageManifestPath = path.join(
  archiveRoot,
  "image-conversion-manifest.json"
);
const postManifestPath = path.join(archiveRoot, "post-import-manifest.json");
const contentRoot = path.join(projectRoot, "content/facebook-archive");

const imagePattern = /\.(?:jpe?g|png|gif)$/i;
const videoPattern = /\.(?:mp4|mov|m4v|avi|webm)$/i;
const cwebpPath = process.env.CWEBP_PATH || "/opt/homebrew/bin/cwebp";

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find(argument => argument.startsWith("--limit="));
const limit = args.has("--all")
  ? Number.POSITIVE_INFINITY
  : limitArg
    ? Number(limitArg.split("=")[1])
    : 25;
const manifestOnly = args.has("--manifest-only");

if (!Number.isFinite(limit) && !args.has("--all")) {
  throw new Error("--limit must be a positive number");
}

function projectPath(absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function fixFacebookText(value = "") {
  let text = String(value);
  if (/[ÃÂâð][\u0080-\u00bf]/.test(text)) {
    const characters = [...text];
    if (characters.every(character => character.charCodeAt(0) <= 255)) {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(characters, character => character.charCodeAt(0))
        );
      } catch {
        // Keep the original when a string is not actually mojibake.
      }
    }
  }
  return text
    .replace(/@\[\d+:\d+:([^\]]+)\]/g, "$1")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function getPostText(post) {
  return fixFacebookText(
    post.data?.find(entry => typeof entry?.post === "string")?.post ?? ""
  );
}

function getMedia(post) {
  return (post.attachments ?? [])
    .flatMap(attachment => attachment.data ?? [])
    .map(entry => entry?.media)
    .filter(Boolean);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

function firstSentence(value) {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  const sentence = singleLine.match(/^.{1,120}?(?:[.!?](?=\s|$)|$)/)?.[0];
  return (sentence || singleLine).trim();
}

function shorten(value, maximum) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum - 1).replace(/\s+\S*$/, "");
  return `${shortened || value.slice(0, maximum - 1)}…`;
}

function makeTitle(text, captions, timestamp) {
  const source = firstSentence(text || captions.find(Boolean) || "");
  if (source) return shorten(source, 90);
  return `Facebook photograph from ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(timestamp * 1000))}`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function findExistingContentByPostIndex() {
  const result = new Map();
  if (!fs.existsSync(contentRoot)) return result;
  for (const name of fs.readdirSync(contentRoot)) {
    if (!name.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(contentRoot, name), "utf8");
    const match = content.match(/^sourcePostIndex:\s*(\d+)\s*$/m);
    if (match) result.set(Number(match[1]), `content/facebook-archive/${name}`);
  }
  return result;
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, run)
  );
  return results;
}

function summarize(entries) {
  return entries.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] = (summary[entry.status] ?? 0) + 1;
      summary.imageReferences += entry.imageUris.length;
      return summary;
    },
    { total: 0, imageReferences: 0 }
  );
}

function writeManifest(entries) {
  const manifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    policy: {
      included: "Posts containing text and/or still images",
      excluded: "Any post containing a video attachment",
      generatedDraftsRequireReview: true,
    },
    summary: summarize(entries),
    posts: entries,
  };
  fs.mkdirSync(path.dirname(postManifestPath), { recursive: true });
  fs.writeFileSync(postManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (!fs.existsSync(postsPath)) throw new Error(`Missing ${postsPath}`);
if (!fs.existsSync(imageManifestPath)) {
  throw new Error(
    "Missing image-conversion-manifest.json; run scripts/facebook-image-manifest.mjs first"
  );
}
if (!fs.existsSync(cwebpPath)) throw new Error(`Missing cwebp at ${cwebpPath}`);

const posts = JSON.parse(fs.readFileSync(postsPath, "utf8"));
const imageManifest = JSON.parse(fs.readFileSync(imageManifestPath, "utf8"));
const imageByUri = new Map(
  imageManifest.images.map(image => [image.sourceUri, image])
);
const previousManifest = fs.existsSync(postManifestPath)
  ? JSON.parse(fs.readFileSync(postManifestPath, "utf8"))
  : { posts: [] };
const previousByIndex = new Map(
  previousManifest.posts.map(post => [post.sourcePostIndex, post])
);
const existingContentByIndex = findExistingContentByPostIndex();

const entries = posts.map((post, sourcePostIndex) => {
  const text = getPostText(post);
  const media = getMedia(post);
  const imageUris = media
    .map(item => item.uri)
    .filter(uri => typeof uri === "string" && imagePattern.test(uri));
  const videoUris = media
    .map(item => item.uri)
    .filter(uri => typeof uri === "string" && videoPattern.test(uri));
  const eligible = (Boolean(text) || imageUris.length > 0) && videoUris.length === 0;
  const existingContentPath = existingContentByIndex.get(sourcePostIndex);
  const previous = previousByIndex.get(sourcePostIndex);
  const previousFileExists =
    previous?.contentPath &&
    fs.existsSync(path.join(projectRoot, previous.contentPath));

  let status = "skipped-unsupported";
  if (videoUris.length) status = "deferred-video";
  else if (eligible) status = "pending";
  if (existingContentPath || previousFileExists) status = "imported";
  if (previous?.status === "failed" && eligible) status = "pending";

  return {
    sourcePostIndex,
    sourceTimestamp: post.timestamp,
    facebookTitle: fixFacebookText(post.title ?? ""),
    hasText: Boolean(text),
    imageUris,
    videoUris,
    status,
    contentPath: existingContentPath ?? previous?.contentPath ?? null,
    convertedImageIds: previous?.convertedImageIds ?? [],
    error: null,
  };
});

writeManifest(entries);
console.log("Archive plan:", JSON.stringify(summarize(entries), null, 2));

if (!manifestOnly) {
  fs.mkdirSync(contentRoot, { recursive: true });
  const pending = entries.filter(entry => entry.status === "pending").slice(0, limit);
  console.log(`Importing ${pending.length} eligible posts...`);

  for (let current = 0; current < pending.length; current += 1) {
    const entry = pending[current];
    const post = posts[entry.sourcePostIndex];
    try {
      const text = getPostText(post);
      const media = getMedia(post);
      const imageMedia = media.filter(
        item => typeof item.uri === "string" && imagePattern.test(item.uri)
      );
      const captions = imageMedia.map(item => fixFacebookText(item.description ?? ""));
      const title = makeTitle(text, captions, entry.sourceTimestamp);
      const description = shorten(
        (text || captions.find(Boolean) || title).replace(/\s+/g, " "),
        190
      );
      const date = new Date(entry.sourceTimestamp * 1000);
      const datePrefix = date.toISOString().slice(0, 10);
      const slug = `${datePrefix}-${slugify(title) || "facebook-post"}-${entry.sourcePostIndex}`;
      const contentPath = path.join(contentRoot, `${slug}.md`);

      const convertedMedia = await mapWithConcurrency(
        imageMedia,
        4,
        async item => {
          const image = imageByUri.get(item.uri);
          if (!image) throw new Error(`No source image found for ${item.uri}`);
          const sourcePath = path.join(projectRoot, image.sourcePath);
          const outputPath = path.join(projectRoot, image.outputPath);
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          if (!fs.existsSync(outputPath)) {
            await execFileAsync(cwebpPath, [
              "-quiet",
              "-q",
              "75",
              "-m",
              "6",
              sourcePath,
              "-o",
              outputPath,
            ]);
          }
          const metadata = await sharp(outputPath).metadata();
          return {
            src: `/${projectPath(outputPath).replace(/^public\//, "")}`,
            sourceId: image.sourceId,
            width: metadata.width,
            height: metadata.height,
            alt: `Photograph from the Facebook post “${title}”`,
            caption: fixFacebookText(item.description ?? ""),
          };
        }
      );

      const albums = [
        ...new Set(
          imageMedia.map(item => fixFacebookText(item.title ?? "")).filter(Boolean)
        ),
      ];
      const body =
        text ||
        [...new Set(captions.filter(Boolean))].join("\n\n") ||
        "Photograph preserved from the All Things Sabine Facebook Page.";
      const lines = [
        "---",
        `title: ${yamlString(title)}`,
        `description: ${yamlString(description)}`,
        `publishedAt: ${date.toISOString()}`,
        "historicalDatePrecision: unknown",
        "source: facebook",
        `sourceTimestamp: ${entry.sourceTimestamp}`,
        `sourcePostIndex: ${entry.sourcePostIndex}`,
        `facebookTitle: ${yamlString(entry.facebookTitle)}`,
        ...(albums.length === 1 ? [`album: ${yamlString(albums[0])}`] : []),
        "tags: []",
        "draft: true",
        "reviewStatus: pending",
        "mediaReviewStatus: pending",
        "commentImportStatus: pending",
        "media:",
        ...(convertedMedia.length
          ? convertedMedia.flatMap(image => [
              `  - src: ${yamlString(image.src)}`,
              `    sourceId: ${yamlString(image.sourceId)}`,
              `    width: ${image.width}`,
              `    height: ${image.height}`,
              `    alt: ${yamlString(image.alt)}`,
              ...(image.caption
                ? [`    caption: ${yamlString(image.caption)}`]
                : []),
            ])
          : ["  []"]),
        "---",
        "",
        body,
        "",
      ];
      fs.writeFileSync(contentPath, lines.join("\n"));
      entry.status = "imported";
      entry.contentPath = projectPath(contentPath);
      entry.convertedImageIds = convertedMedia.map(image => image.sourceId);
      entry.error = null;
    } catch (error) {
      entry.status = "failed";
      entry.error = error instanceof Error ? error.message : String(error);
    }
    writeManifest(entries);
    if ((current + 1) % 10 === 0 || current + 1 === pending.length) {
      console.log(`Completed ${current + 1}/${pending.length} posts`);
    }
  }
}

console.log("Final status:", JSON.stringify(summarize(entries), null, 2));
