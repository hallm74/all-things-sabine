import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const manifestPath = path.join(
  projectRoot,
  "data/facebook-import/post-import-manifest.json"
);

if (!fs.existsSync(manifestPath)) {
  throw new Error("Missing data/facebook-import/post-import-manifest.json");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];
const imported = manifest.posts.filter(post => post.status === "imported");
const deferredVideos = manifest.posts.filter(
  post => post.status === "deferred-video"
);
const importedVideos = manifest.posts.filter(
  post => post.status === "imported-video"
);
const seenIndexes = new Set();
const seenContentPaths = new Set();
let mediaReferences = 0;

for (const post of imported) {
  if (seenIndexes.has(post.sourcePostIndex)) {
    errors.push(`Duplicate source post index ${post.sourcePostIndex}`);
  }
  seenIndexes.add(post.sourcePostIndex);

  if (!post.contentPath) {
    errors.push(`Imported post ${post.sourcePostIndex} has no content path`);
    continue;
  }
  if (seenContentPaths.has(post.contentPath)) {
    errors.push(`Duplicate content path ${post.contentPath}`);
  }
  seenContentPaths.add(post.contentPath);

  const absoluteContentPath = path.join(projectRoot, post.contentPath);
  if (!fs.existsSync(absoluteContentPath)) {
    errors.push(`Missing content file ${post.contentPath}`);
    continue;
  }

  const content = fs.readFileSync(absoluteContentPath, "utf8");
  const sourceIndex = Number(
    content.match(/^sourcePostIndex:\s*(\d+)\s*$/m)?.[1]
  );
  if (sourceIndex !== post.sourcePostIndex) {
    errors.push(`Source index mismatch in ${post.contentPath}`);
  }
  if (/\.(?:mp4|mov|m4v|avi|webm)(?:["'\s]|$)/i.test(content)) {
    errors.push(`Video reference found in ${post.contentPath}`);
  }

  for (const match of content.matchAll(/^\s*-\s+src:\s*"([^"]+)"\s*$/gm)) {
    mediaReferences += 1;
    const publicPath = path.join(projectRoot, "public", match[1]);
    if (!fs.existsSync(publicPath)) {
      errors.push(`Missing media ${match[1]} from ${post.contentPath}`);
    }
  }
}

for (const post of deferredVideos) {
  if (post.contentPath) {
    errors.push(`Deferred video post ${post.sourcePostIndex} has content output`);
  }
  if (post.videoUris.length === 0) {
    errors.push(`Deferred video post ${post.sourcePostIndex} has no video URI`);
  }
}

for (const post of importedVideos) {
  if (!post.contentPath || !fs.existsSync(path.join(projectRoot, post.contentPath))) {
    errors.push(`Imported video post ${post.sourcePostIndex} has no content output`);
  }
  if (post.videoUris.length === 0 || !post.videoUrl || !post.videoObjectKey) {
    errors.push(`Imported video post ${post.sourcePostIndex} is missing video metadata`);
  }
}

const result = {
  importedPosts: imported.length,
  deferredVideoPosts: deferredVideos.length,
  importedVideoPosts: importedVideos.length,
  validatedMediaReferences: mediaReferences,
  errors: errors.length,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  process.exitCode = 1;
}
