import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, "content/facebook-archive");
const importRoot = path.join(projectRoot, "data/facebook-import");
const reviewPath = path.join(importRoot, "codex-pre-review.json");
const selectionPath = path.join(
  importRoot,
  "historical-photo-publish-selection.json"
);
const applyChanges = process.argv.includes("--apply");

const review = fs.existsSync(reviewPath)
  ? JSON.parse(fs.readFileSync(reviewPath, "utf8"))
  : { posts: [] };
const reviewByIndex = new Map(
  review.posts.map(post => [post.sourcePostIndex, post])
);

const patterns = {
  explicitOldPhoto:
    /\b(?:old|older|historic|historical|vintage|antique|early)\s+(?:photo|photograph|picture|image)s?\b/i,
  retrospective:
    /\b(?:picture of the past|blast from the past|throwback|looking back|then and now|from days gone by)\b/i,
  archiveSource:
    /\b(?:from|courtesy of|published in|appeared in)\s+(?:the\s+)?(?:sabine index|newspaper|archives?|yearbook|historical collection)\b/i,
  newspaper:
    /\b(?:newspaper clipping|news clipping|sabine index|index photo|yearbook|obituary)\b/i,
  datedLanguage:
    /\b(?:circa|back in|taken in|photographed in|built in|opened in|founded in|class of)\b/i,
  historicalEra:
    /\b(?:world war (?:i|ii|one|two)|civil war|great depression|reconstruction era|antebellum)\b/i,
  historicalSubject:
    /\b(?:old|historic|historical)\s+(?:bridge|building|church|school|store|hotel|house|home|theater|theatre|depot|mill|courthouse|downtown|ferry|road|highway|plantation|community)\b/i,
  presentMoment:
    /\b(?:taken today|taken this morning|happening now|live now|tonight|tomorrow|currently|breaking news)\b/i,
};

async function averageChroma(imagePath) {
  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels < 3) return 0;
  let chroma = 0;
  const pixels = data.length / info.channels;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    chroma += Math.max(red, green, blue) - Math.min(red, green, blue);
  }
  return chroma / pixels;
}

function historicalYears(text, publishedYear) {
  return [
    ...new Set(
      [...text.matchAll(/\b(18\d{2}|19\d{2}|20[0-2]\d)(?:s)?\b/g)].map(
        match => Number(match[1])
      )
    ),
  ].filter(year => year <= 2005 && year <= publishedYear - 15);
}

const files = fs
  .readdirSync(contentRoot)
  .filter(name => name.endsWith(".md"))
  .sort();
const candidates = [];
const rejected = [];

for (const name of files) {
  const contentPath = path.join(contentRoot, name);
  const raw = fs.readFileSync(contentPath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data;
  if (!data.draft || !Array.isArray(data.media) || data.media.length === 0) {
    continue;
  }

  const reviewPost = reviewByIndex.get(Number(data.sourcePostIndex));
  const ocrText = reviewPost?.ocrPreview ?? "";
  const headlineText = [
    data.title,
    data.description,
    ...data.media.flatMap(image => [image.caption ?? "", image.alt ?? ""]),
    ocrText,
  ].join("\n");
  const text = `${headlineText}\n${parsed.content}`;
  const publishedYear = new Date(data.publishedAt).getUTCFullYear();
  const years = historicalYears(headlineText, publishedYear);
  const signals = [];
  let score = 0;

  if (patterns.explicitOldPhoto.test(text)) {
    score += 6;
    signals.push("explicit-old-photo-language");
  }
  if (patterns.retrospective.test(text)) {
    score += 6;
    signals.push("retrospective-language");
  }
  if (patterns.archiveSource.test(text)) {
    score += 5;
    signals.push("archive-source-language");
  }
  if (patterns.newspaper.test(text)) {
    score += 4;
    signals.push("newspaper-or-yearbook-language");
  }
  if (patterns.datedLanguage.test(text)) {
    score += 2;
    signals.push("dated-language");
  }
  if (patterns.historicalEra.test(text)) {
    score += 4;
    signals.push("historical-era-language");
  }
  if (patterns.historicalSubject.test(text)) {
    score += 4;
    signals.push("historical-subject-language");
  }
  if (years.length) {
    const oldestYear = Math.min(...years);
    score += oldestYear <= 1950 ? 5 : oldestYear <= 1980 ? 4 : 3;
    signals.push(`historical-year:${years.join(",")}`);
  }

  const firstImagePath = path.join(
    projectRoot,
    "public",
    String(data.media[0].src).replace(/^\/+/, "")
  );
  const chroma = await averageChroma(firstImagePath);
  if (chroma <= 18) {
    score += 2;
    signals.push("low-color-or-monochrome-image");
  }
  if (patterns.presentMoment.test(text) && signals.length <= 1) {
    score -= 5;
    signals.push("present-moment-language");
  }

  const item = {
    sourcePostIndex: Number(data.sourcePostIndex),
    contentPath: path.relative(projectRoot, contentPath),
    title: data.title,
    publishedAt: new Date(data.publishedAt).toISOString(),
    imageCount: data.media.length,
    score,
    averageChroma: Number(chroma.toFixed(2)),
    signals,
  };
  const hasHistoricalYear = signals.some(signal =>
    signal.startsWith("historical-year")
  );
  const hasStrongHistoricalLanguage = signals.some(signal =>
    /^(?:explicit|retrospective|archive|newspaper)/.test(signal)
  );
  const hasHistoricalEraPhoto =
    signals.includes("historical-era-language") &&
    /\b(?:photo|photograph|picture|image|soldiers?|troops?|crew)\b/i.test(
      headlineText
    );
  if (
    (hasHistoricalYear && score >= 3) ||
    (hasStrongHistoricalLanguage && score >= 4) ||
    (hasHistoricalEraPhoto && score >= 4)
  )
    candidates.push(item);
  else rejected.push(item);
}

candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: applyChanges ? "applied" : "dry-run",
  policy:
    "Conservative high-confidence selection of posts containing historical old pictures; ambiguous and current-event photo posts remain drafts.",
  selectionRule:
    "A historical year at least 15 years before publication with score >=3; strong archival/old-photo language with score >=4; or a named historical era paired with photograph language. References to an old building or place alone do not qualify.",
  summary: {
    evaluatedImageDrafts: candidates.length + rejected.length,
    selected: candidates.length,
    keptDraft: rejected.length,
  },
  selected: candidates,
  keptDraft: rejected,
};
fs.writeFileSync(selectionPath, `${JSON.stringify(report, null, 2)}\n`);

if (applyChanges) {
  for (const candidate of candidates) {
    const absolutePath = path.join(projectRoot, candidate.contentPath);
    const raw = fs.readFileSync(absolutePath, "utf8");
    const updated = raw.replace(/^draft:\s*true\s*$/m, "draft: false");
    if (updated === raw) {
      throw new Error(`Could not update draft status in ${candidate.contentPath}`);
    }
    fs.writeFileSync(absolutePath, updated);
  }
}

console.log(JSON.stringify(report.summary, null, 2));
