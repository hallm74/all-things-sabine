import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const importRoot = path.join(projectRoot, "data/facebook-import");
const extractedRoot = path.join(importRoot, "extracted");
const primaryExportRoot = path.join(extractedRoot, "export-viUXWXE3");
const exportRoots = [
  primaryExportRoot,
  ...fs
    .readdirSync(extractedRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(extractedRoot, entry.name))
    .filter(candidate => candidate !== primaryExportRoot),
];
const postsPath = path.join(
  primaryExportRoot,
  "this_profile's_activity_across_facebook/posts/profile_posts_1.json"
);
const postManifestPath = path.join(importRoot, "post-import-manifest.json");
const imageManifestPath = path.join(importRoot, "image-conversion-manifest.json");
const publishManifestPath = path.join(importRoot, "video-publish-manifest.json");
const contentRoot = path.join(projectRoot, "content/facebook-archive");
const stagingRoot = path.join(importRoot, "video-upload-staging");
const bucket = "allthingssabine-videos";
const endpoint = "us-ord-10.linodeobjects.com";
const cwebpPath = process.env.CWEBP_PATH || "/opt/homebrew/bin/cwebp";
const shouldWrite = process.argv.includes("--write");
const shouldStage = process.argv.includes("--stage");

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
        // Keep the original when it is not mojibake.
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
  return (
    singleLine.match(/^.{1,120}?(?:[.!?](?=\s|$)|$)/)?.[0] || singleLine
  ).trim();
}

function shorten(value, maximum) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum - 1).replace(/\s+\S*$/, "");
  return `${shortened || value.slice(0, maximum - 1)}…`;
}

function resolveExportFile(uri) {
  const candidates = exportRoots.map(root => path.resolve(root, uri));
  const resolved = candidates.find(
    candidate => fs.existsSync(candidate) && fs.statSync(candidate).size > 0
  );
  if (!resolved) throw new Error(`Missing exported file: ${uri}`);
  return resolved;
}

function probeVideo(videoPath) {
  const output = execFileSync(
    "/opt/homebrew/bin/ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,width,height:format=duration",
      "-of",
      "json",
      videoPath,
    ],
    { encoding: "utf8" }
  );
  const result = JSON.parse(output);
  const video = result.streams.find(stream => stream.codec_type === "video");
  if (!video?.width || !video?.height) {
    throw new Error(`No usable video stream: ${videoPath}`);
  }
  return {
    width: video.width,
    height: video.height,
    durationSeconds: Number(Number(result.format.duration).toFixed(3)),
    hasAudio: result.streams.some(stream => stream.codec_type === "audio"),
  };
}

async function prepareImages(imageUris, title) {
  const prepared = [];
  for (const uri of imageUris) {
    const image = imageByUri.get(uri);
    if (!image) throw new Error(`No image manifest entry for ${uri}`);
    const outputPath = path.join(projectRoot, image.outputPath);
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      execFileSync(cwebpPath, ["-quiet", "-q", "82", image.sourcePath, "-o", outputPath]);
    }
    const metadata = await sharp(outputPath).metadata();
    prepared.push({
      src: `/${path.relative(path.join(projectRoot, "public"), outputPath).split(path.sep).join("/")}`,
      sourceId: image.sourceId,
      width: metadata.width,
      height: metadata.height,
      alt: title,
    });
  }
  return prepared;
}

function yamlMedia(media) {
  if (!media.length) return "media:\n  []";
  return `media:\n${media
    .map(
      image => `  - src: ${JSON.stringify(image.src)}
    sourceId: ${JSON.stringify(image.sourceId)}
    width: ${image.width}
    height: ${image.height}
    alt: ${JSON.stringify(image.alt)}`
    )
    .join("\n")}`;
}

const rawPosts = JSON.parse(fs.readFileSync(postsPath, "utf8"));
const postManifest = JSON.parse(fs.readFileSync(postManifestPath, "utf8"));
const imageManifest = JSON.parse(fs.readFileSync(imageManifestPath, "utf8"));
const imageByUri = new Map(
  imageManifest.images.map(image => [image.sourceUri, image])
);
const selected = postManifest.posts.filter(
  post =>
    ["deferred-video", "imported-video"].includes(post.status) && post.hasText
);
const existingIndexes = new Set(
  fs
    .readdirSync(contentRoot)
    .filter(name => name.endsWith(".md"))
    .map(name => fs.readFileSync(path.join(contentRoot, name), "utf8"))
    .map(content => content.match(/^sourcePostIndex:\s*(\d+)\s*$/m)?.[1])
    .filter(Boolean)
    .map(Number)
);

const planned = [];
for (const entry of selected) {
  const post = rawPosts[entry.sourcePostIndex];
  const text = getPostText(post);
  if (!text) throw new Error(`Selected video post ${entry.sourcePostIndex} has no text`);
  const sourceVideoPath = resolveExportFile(entry.videoUris[0]);
  const sourceId = path.basename(sourceVideoPath, path.extname(sourceVideoPath));
  const objectName = `${entry.sourcePostIndex}-${path.basename(sourceVideoPath)}`;
  const objectKey = `facebook-archive/videos/${objectName}`;
  const src = `https://${bucket}.${endpoint}/${objectKey}`;
  const title = shorten(firstSentence(text), 90);
  const description = shorten(text.replace(/\s+/g, " "), 190);
  const publishedAt = new Date(entry.sourceTimestamp * 1000);
  const slug = `${publishedAt.toISOString().slice(0, 10)}-${slugify(title) || "facebook-video"}-${entry.sourcePostIndex}`;
  planned.push({
    sourcePostIndex: entry.sourcePostIndex,
    sourceTimestamp: entry.sourceTimestamp,
    facebookTitle: fixFacebookText(entry.facebookTitle),
    title,
    description,
    text,
    publishedAt: publishedAt.toISOString(),
    slug,
    contentPath: `content/facebook-archive/${slug}.md`,
    sourceVideoPath,
    sourceId,
    objectName,
    objectKey,
    src,
    bytes: fs.statSync(sourceVideoPath).size,
    imageUris: entry.imageUris,
  });
}
const initiallyExistingSelected = planned.filter(item =>
  existingIndexes.has(item.sourcePostIndex)
).length;

if (shouldStage) {
  fs.mkdirSync(stagingRoot, { recursive: true });
  for (const item of planned) {
    const stagedPath = path.join(stagingRoot, item.objectName);
    if (!fs.existsSync(stagedPath)) fs.symlinkSync(item.sourceVideoPath, stagedPath);
  }
}

if (shouldWrite) {
  for (const item of planned) {
    if (existingIndexes.has(item.sourcePostIndex)) continue;
    const video = probeVideo(item.sourceVideoPath);
    const media = await prepareImages(item.imageUris, item.title);
    const frontmatter = `---
title: ${JSON.stringify(item.title)}
description: ${JSON.stringify(item.description)}
publishedAt: ${item.publishedAt}
historicalDatePrecision: unknown
source: facebook
sourceTimestamp: ${item.sourceTimestamp}
sourcePostIndex: ${item.sourcePostIndex}
facebookTitle: ${JSON.stringify(item.facebookTitle)}
facebookActivityType: video
tags: []
draft: false
reviewStatus: reviewed
mediaReviewStatus: pending
commentImportStatus: pending
${yamlMedia(media)}
video:
  src: ${JSON.stringify(item.src)}
  sourceId: ${JSON.stringify(item.sourceId)}
  mimeType: video/mp4
  bytes: ${item.bytes}
  width: ${video.width}
  height: ${video.height}
  durationSeconds: ${video.durationSeconds}
  hasAudio: ${video.hasAudio}
---

${item.text}
`;
    fs.writeFileSync(path.join(projectRoot, item.contentPath), frontmatter);
    existingIndexes.add(item.sourcePostIndex);
  }
  const plannedByIndex = new Map(
    planned.map(item => [item.sourcePostIndex, item])
  );
  for (const entry of postManifest.posts) {
    const item = plannedByIndex.get(entry.sourcePostIndex);
    if (!item) continue;
    entry.status = "imported-video";
    entry.contentPath = item.contentPath;
    entry.videoObjectKey = item.objectKey;
    entry.videoUrl = item.src;
  }
  postManifest.updatedAt = new Date().toISOString();
  postManifest.summary = postManifest.posts.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary.imageReferences += entry.imageUris.length;
      summary[entry.status] = (summary[entry.status] ?? 0) + 1;
      return summary;
    },
    { total: 0, imageReferences: 0 }
  );
  fs.writeFileSync(
    postManifestPath,
    `${JSON.stringify(postManifest, null, 2)}\n`
  );
}

const publishManifest = {
  version: 1,
  updatedAt: new Date().toISOString(),
  bucket,
  endpoint,
  policy: "Facebook video posts with accompanying text",
  summary: {
    posts: planned.length,
    bytes: planned.reduce((total, item) => total + item.bytes, 0),
    staged: shouldStage,
    contentWritten: shouldWrite,
  },
  posts: planned.map(({ text, sourceVideoPath, ...item }) => ({
    ...item,
    sourceVideoPath: path.relative(projectRoot, sourceVideoPath),
  })),
};
fs.writeFileSync(publishManifestPath, `${JSON.stringify(publishManifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      selected: planned.length,
      bytes: publishManifest.summary.bytes,
      stagingRoot: shouldStage ? path.relative(projectRoot, stagingRoot) : null,
      contentWritten: shouldWrite,
      alreadyExisted: initiallyExistingSelected,
      manifest: path.relative(projectRoot, publishManifestPath),
    },
    null,
    2
  )
);
