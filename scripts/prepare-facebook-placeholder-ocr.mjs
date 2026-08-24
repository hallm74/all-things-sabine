import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const importRoot = path.join(projectRoot, "data/facebook-import");
const report = JSON.parse(
  fs.readFileSync(path.join(importRoot, "codex-pre-review.json"), "utf8")
);
const lines = [];

for (const post of report.posts.filter(post =>
  post.flags.includes("generated-placeholder-title")
)) {
  const parsed = matter(
    fs.readFileSync(path.join(projectRoot, post.contentPath), "utf8")
  );
  const image = parsed.data.media?.[0];
  if (!image) continue;
  lines.push(
    `${post.sourcePostIndex}\t${path.join(projectRoot, "public", image.src)}`
  );
}

const outputPath = path.join(importRoot, "placeholder-image-ocr-input.tsv");
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ images: lines.length, outputPath }, null, 2));
