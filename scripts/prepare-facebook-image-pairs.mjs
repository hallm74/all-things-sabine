import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const reportPath = path.join(
  projectRoot,
  "data/facebook-import/codex-pre-review.json"
);
const outputPath = path.join(
  projectRoot,
  "data/facebook-import/image-review-pairs.tsv"
);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const lines = [];

for (const post of report.posts.filter(post => post.imageCount > 1)) {
  const parsed = matter(
    fs.readFileSync(path.join(projectRoot, post.contentPath), "utf8")
  );
  const images = parsed.data.media.map(media =>
    path.join(projectRoot, "public", media.src)
  );
  for (let first = 0; first < images.length; first += 1) {
    for (let second = first + 1; second < images.length; second += 1) {
      lines.push(
        [post.sourcePostIndex, images[first], images[second]].join("\t")
      );
    }
  }
}

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ posts: 1390, pairs: lines.length, outputPath }, null, 2));
