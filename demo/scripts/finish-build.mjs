import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import kebabcase from "lodash.kebabcase";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.join(root, "demo/dist");
const production = process.env.SITE_MODE === "production";
const origin = production
  ? "https://allthingssabine.com"
  : "https://demo.allthingssabine.com";
const sources = JSON.parse(await fs.readFile(new URL("../src/lib/directory-sources.json", import.meta.url), "utf8"));
const redirects = [
  "/api/calendar/* https://hallm-menus-api.fly.dev/api/calendar/:splat 200!",
  "/api/submissions/code/ https://hallm-menus-api.fly.dev/api/submissions/code/ 200!",
  "/api/submissions/verify/ https://hallm-menus-api.fly.dev/api/submissions/verify/ 200!",
  "/api/directory-submissions/events/ https://hallm-menus-api.fly.dev/api/directory-submissions/events/ 200!",
  ...Object.entries(sources).map(([kind, source]) => `/api/directories/${kind} ${source.url} 200!`),
  ...(production
    ? [
        "https://www.allthingssabine.com/* https://allthingssabine.com/:splat 301!",
      ]
    : []),
  "/posts /stories/ 301",
  "/posts/ /stories/ 301",
  "/archives /stories/ 301",
  "/archives/ /stories/ 301",
  "/search /stories/#browse 301",
  "/search/ /stories/#browse 301",
  "/tags /stories/ 301",
  "/tags/* /stories/ 301",
  "/facebook-archive /time-capsule/ 301",
  "/facebook-archive/ /time-capsule/ 301",
  "/facebook-archive/page/* /time-capsule/ 301",
  "/facebook-archive/:slug /time-capsule/:slug/ 301",
  "/facebook-archive/:slug/ /time-capsule/:slug/ 301",
];
for (const file of (
  await fs.readdir(path.join(root, "src/content/blog"))
).filter(f => f.endsWith(".md"))) {
  const { data } = matter(
    await fs.readFile(path.join(root, "src/content/blog", file), "utf8")
  );
  if (data.draft || new Date(data.pubDatetime) > new Date()) continue;
  const slug = kebabcase(data.title);
  const oldSlug = data.slug || file.replace(/\.md$/, "");
  redirects.push(
    `/posts/${oldSlug} /stories/${slug}/ 301`,
    `/posts/${oldSlug}/ /stories/${slug}/ 301`
  );
  // Preserve old title-based and WordPress-era links as well.
  redirects.push(
    `/posts/${slug} /stories/${slug}/ 301`,
    `/${slug}/ /stories/${slug}/ 301`
  );
}
redirects.push("/posts/* /stories/ 301");
await fs.writeFile(
  path.join(dist, "_redirects"),
  [...new Set(redirects)].join("\n") + "\n"
);
await fs.writeFile(
  path.join(dist, "_headers"),
  `/*\n${production ? "" : "  X-Robots-Tag: noindex, nofollow\n"}  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`
);
await fs.writeFile(
  path.join(dist, "robots.txt"),
  production
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`
    : "User-agent: *\nDisallow: /\n"
);
if (production) {
  // These URLs are used by the archive and must travel with every production deploy.
  for (const dir of ["facebook-archive", "assets"]) {
    await fs.cp(path.join(root, "public", dir), path.join(dist, dir), {
      recursive: true,
    });
  }
}
console.log(
  `Prepared ${production ? "production" : "demo"} headers, redirects, robots, and media.`
);
