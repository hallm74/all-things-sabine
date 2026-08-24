import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const importRoot = path.join(projectRoot, "data/facebook-import");
const sourcePath = path.join(
  importRoot,
  "extracted/export-viUXWXE3/this_profile's_activity_across_facebook/posts/profile_posts_1.json"
);
const manifestPath = path.join(importRoot, "post-import-manifest.json");
const reportPath = path.join(importRoot, "codex-pre-review.json");
const markdownReportPath = path.join(importRoot, "codex-pre-review.md");
const imageDistancesPath = path.join(
  importRoot,
  "image-review-distances.tsv"
);
const placeholderOcrPath = path.join(
  importRoot,
  "placeholder-image-ocr-results.tsv"
);

const imagePattern = /\.(?:jpe?g|png|gif)$/i;
const videoPattern = /\.(?:mp4|mov|m4v|avi|webm)$/i;
const suspiciousEncodingPattern = /(?:Ã.|Â.|â[\u0080-\u00bf]|ð[\u0080-\u00bf]|�)/;

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
        // Preserve strings that were not encoded as UTF-8 bytes in Latin-1.
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

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function increment(object, key) {
  object[key] = (object[key] ?? 0) + 1;
}

const sourcePosts = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const issueCounts = {};
const titleCounts = new Map();
const reviewedPosts = [];
const imageDimensions = new Map();

for (const entry of manifest.posts.filter(post => post.status === "imported")) {
  const source = sourcePosts[entry.sourcePostIndex];
  const absoluteContentPath = path.join(projectRoot, entry.contentPath);
  const rawContent = fs.readFileSync(absoluteContentPath, "utf8");
  const parsed = matter(rawContent);
  const data = parsed.data;
  const body = parsed.content.trim();
  const sourceText = getPostText(source);
  const sourceMedia = getMedia(source);
  const sourceImages = sourceMedia.filter(
    media => typeof media.uri === "string" && imagePattern.test(media.uri)
  );
  const sourceVideos = sourceMedia.filter(
    media => typeof media.uri === "string" && videoPattern.test(media.uri)
  );
  const sourceCaptions = sourceImages
    .map(media => fixFacebookText(media.description ?? ""))
    .filter(Boolean);
  const expectedBody =
    sourceText ||
    [...new Set(sourceCaptions)].join("\n\n") ||
    "Photograph preserved from the All Things Sabine Facebook Page.";
  const contentImages = Array.isArray(data.media) ? data.media : [];
  for (const image of contentImages) {
    imageDimensions.set(
      path.join("public", String(image.src).replace(/^\/+/, "")),
      { width: Number(image.width), height: Number(image.height) }
    );
  }
  const sourceImageIds = sourceImages.map(media =>
    path.basename(media.uri, path.extname(media.uri))
  );
  const contentImageIds = contentImages.map(media => String(media.sourceId));
  const flags = [];
  const blocking = [];

  if (Number(data.sourcePostIndex) !== entry.sourcePostIndex) {
    blocking.push("source-index-mismatch");
  }
  if (Number(data.sourceTimestamp) !== Number(source.timestamp)) {
    blocking.push("source-timestamp-mismatch");
  }
  if (
    Math.floor(new Date(data.publishedAt).valueOf() / 1000) !==
    Number(source.timestamp)
  ) {
    blocking.push("published-date-mismatch");
  }
  if (sourceVideos.length > 0) blocking.push("video-post-imported");

  const curatedSample = entry.sourcePostIndex === 446;
  if (
    !curatedSample &&
    normalizeText(body) !== normalizeText(expectedBody)
  ) {
    blocking.push("body-source-mismatch");
  }
  if (
    !curatedSample &&
    (sourceImageIds.length !== contentImageIds.length ||
      sourceImageIds.some((id, index) => id !== contentImageIds[index]))
  ) {
    blocking.push("image-source-mismatch");
  }

  const fullText = `${data.title}\n${data.description}\n${body}\n${contentImages
    .map(media => `${media.alt ?? ""}\n${media.caption ?? ""}`)
    .join("\n")}`;
  if (suspiciousEncodingPattern.test(fullText)) {
    blocking.push("suspicious-character-encoding");
  }
  if (/@\[\d+:\d+:/.test(fullText)) flags.push("facebook-mention-not-cleaned");
  if (String(data.title).length < 15 || String(data.title).split(/\s+/).length < 3) {
    flags.push("weak-or-short-title");
  }
  if (/…$/.test(String(data.title))) flags.push("truncated-title");
  if (/…$/.test(String(data.description))) flags.push("truncated-description");
  if (/^Facebook photograph from /.test(String(data.title))) {
    flags.push("generated-placeholder-title");
  }
  if (/^https?:\/\//i.test(String(data.title))) flags.push("url-title");
  if (
    /https?:\/\/[^\s]*(?:youtu\.be|youtube\.com|vimeo\.com|fb\.watch|facebook\.com\/(?:watch|reel)|tiktok\.com)/i.test(
      fullText
    )
  ) {
    flags.push("external-video-link");
  }
  if (contentImages.length === 0) flags.push("text-only-post");
  if (!sourceText) flags.push("no-primary-post-text");
  if (contentImages.length > 1) flags.push("multi-image-review");
  if (contentImages.length >= 10) flags.push("large-gallery-review");
  if (contentImages.some(media => !media.caption)) flags.push("missing-image-caption");
  if (!Array.isArray(data.tags) || data.tags.length === 0) flags.push("needs-tags");
  if (curatedSample) flags.push("curated-sample-exception");

  const normalizedTitle = normalizeText(String(data.title)).toLowerCase();
  titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
  for (const issue of [...blocking, ...flags]) increment(issueCounts, issue);

  reviewedPosts.push({
    sourcePostIndex: entry.sourcePostIndex,
    sourceTimestamp: entry.sourceTimestamp,
    contentPath: entry.contentPath,
    title: data.title,
    imageCount: contentImages.length,
    textLength: body.length,
    blocking,
    flags,
    priority: blocking.length
      ? "blocking"
      : flags.some(flag =>
            [
              "generated-placeholder-title",
              "no-primary-post-text",
              "large-gallery-review",
              "external-video-link",
            ].includes(flag)
          )
        ? "high"
        : flags.some(flag =>
              [
                "weak-or-short-title",
                "truncated-title",
                "multi-image-review",
                "missing-image-caption",
              ].includes(flag)
            )
          ? "medium"
          : "low",
  });
}

for (const post of reviewedPosts) {
  if ((titleCounts.get(normalizeText(String(post.title)).toLowerCase()) ?? 0) > 1) {
    post.flags.push("duplicate-title");
    increment(issueCounts, "duplicate-title");
    if (post.priority === "low") post.priority = "medium";
  }
}

const visualCandidates = {
  visuallyIdenticalPairs: [],
  strongSimilarityPairs: [],
  possibleCropPairs: [],
};
const reviewedByIndex = new Map(
  reviewedPosts.map(post => [post.sourcePostIndex, post])
);

if (fs.existsSync(imageDistancesPath)) {
  const lines = fs
    .readFileSync(imageDistancesPath, "utf8")
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    const [indexValue, distanceValue, firstPath, secondPath] = line.split("\t");
    const sourcePostIndex = Number(indexValue);
    const distance = Number(distanceValue);
    if (!Number.isFinite(distance) || distance > 0.5) continue;
    const firstRelativePath = path.relative(projectRoot, firstPath);
    const secondRelativePath = path.relative(projectRoot, secondPath);
    const firstDimensions = imageDimensions.get(firstRelativePath);
    const secondDimensions = imageDimensions.get(secondRelativePath);
    const candidate = {
      sourcePostIndex,
      distance,
      firstImage: firstRelativePath,
      secondImage: secondRelativePath,
      firstDimensions,
      secondDimensions,
    };
    const post = reviewedByIndex.get(sourcePostIndex);
    if (!post) continue;

    if (distance <= 0.01) {
      visualCandidates.visuallyIdenticalPairs.push(candidate);
      if (!post.flags.includes("visually-identical-image-pair")) {
        post.flags.push("visually-identical-image-pair");
        increment(issueCounts, "visually-identical-image-pair");
      }
      post.priority = "high";
    } else if (distance <= 0.2) {
      visualCandidates.strongSimilarityPairs.push(candidate);
      if (!post.flags.includes("strong-similarity-image-pair")) {
        post.flags.push("strong-similarity-image-pair");
        increment(issueCounts, "strong-similarity-image-pair");
      }
      post.priority = "high";
    } else {
      const firstAspect = firstDimensions
        ? firstDimensions.width / firstDimensions.height
        : 0;
      const secondAspect = secondDimensions
        ? secondDimensions.width / secondDimensions.height
        : 0;
      const orientationChanged =
        firstDimensions && secondDimensions
          ? firstDimensions.width >= firstDimensions.height !==
            secondDimensions.width >= secondDimensions.height
          : false;
      const aspectDifference = Math.abs(firstAspect - secondAspect);
      if (!orientationChanged && aspectDifference < 0.35) continue;
      visualCandidates.possibleCropPairs.push(candidate);
      if (!post.flags.includes("possible-crop-layout-candidate")) {
        post.flags.push("possible-crop-layout-candidate");
        increment(issueCounts, "possible-crop-layout-candidate");
      }
      if (post.priority === "low") post.priority = "medium";
    }
  }
}

const placeholderOcr = { recovered: 0, visualOnly: 0 };
if (fs.existsSync(placeholderOcrPath)) {
  for (const line of fs
    .readFileSync(placeholderOcrPath, "utf8")
    .split("\n")
    .filter(Boolean)) {
    const separator = line.indexOf("\t");
    const sourcePostIndex = Number(line.slice(0, separator));
    const ocrText = line.slice(separator + 1).trim();
    const post = reviewedByIndex.get(sourcePostIndex);
    if (!post) continue;
    post.ocrPreview = ocrText.slice(0, 1000);
    if (ocrText.length >= 20) {
      placeholderOcr.recovered += 1;
      post.flags.push("ocr-text-recovered-for-title-review");
      increment(issueCounts, "ocr-text-recovered-for-title-review");
    } else {
      placeholderOcr.visualOnly += 1;
      post.flags.push("visual-only-placeholder-review");
      increment(issueCounts, "visual-only-placeholder-review");
    }
  }
}

const priorityCounts = reviewedPosts.reduce((counts, post) => {
  increment(counts, post.priority);
  return counts;
}, {});

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  scope: "Imported Facebook text and still-image posts; videos excluded",
  summary: {
    reviewed: reviewedPosts.length,
    blocking: priorityCounts.blocking ?? 0,
    high: priorityCounts.high ?? 0,
    medium: priorityCounts.medium ?? 0,
    low: priorityCounts.low ?? 0,
  },
  issueCounts: Object.fromEntries(
    Object.entries(issueCounts).sort((a, b) => b[1] - a[1])
  ),
  visualReview: {
    calibration:
      "The known tornado full image and two Facebook crop variants scored 0.387–0.462. Lower scores indicate greater visual similarity.",
    visuallyIdenticalPairs: visualCandidates.visuallyIdenticalPairs.length,
    strongSimilarityPairs: visualCandidates.strongSimilarityPairs.length,
    possibleCropPairs: visualCandidates.possibleCropPairs.length,
    candidates: visualCandidates,
  },
  placeholderOcrReview: placeholderOcr,
  posts: reviewedPosts.sort((a, b) => {
    const order = { blocking: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority] || b.sourceTimestamp - a.sourceTimestamp;
  }),
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const topIssues = Object.entries(report.issueCounts)
  .slice(0, 20)
  .map(([issue, count]) => `| ${issue} | ${count} |`)
  .join("\n");
const markdown = `# Facebook Archive Codex Pre-review\n\nGenerated: ${report.generatedAt}\n\n## Summary\n\n| Priority | Posts |\n| --- | ---: |\n| Blocking | ${report.summary.blocking} |\n| High | ${report.summary.high} |\n| Medium | ${report.summary.medium} |\n| Low | ${report.summary.low} |\n\n## Most common flags\n\n| Flag | Posts |\n| --- | ---: |\n${topIssues}\n\nThe JSON report contains the per-post queue, source index, content path, and exact flags.\n`;
fs.writeFileSync(markdownReportPath, markdown);

console.log(JSON.stringify(report.summary, null, 2));
console.log(JSON.stringify(report.issueCounts, null, 2));
