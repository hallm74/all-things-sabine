import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, "content/facebook-archive");
const reportPath = path.join(
  projectRoot,
  "data/facebook-import/published-standalone-text-drafts.json"
);
const published = [];

for (const name of fs.readdirSync(contentRoot).sort()) {
  if (!name.endsWith(".md")) continue;
  const contentPath = path.join(contentRoot, name);
  const raw = fs.readFileSync(contentPath, "utf8");
  const parsed = matter(raw);
  if (
    !parsed.data.draft ||
    parsed.data.media?.length !== 0 ||
    parsed.data.facebookActivityType !== "status"
  ) {
    continue;
  }

  const updated = raw.replace(/^draft:\s*true\s*$/m, "draft: false");
  if (updated === raw) throw new Error(`Could not publish ${name}`);
  fs.writeFileSync(contentPath, updated);
  published.push({
    contentPath: path.relative(projectRoot, contentPath),
    sourcePostIndex: parsed.data.sourcePostIndex,
    title: parsed.data.title,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  policy: "Published complete standalone text statuses approved in local review.",
  publishedCount: published.length,
  published,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ publishedCount: published.length }, null, 2));
