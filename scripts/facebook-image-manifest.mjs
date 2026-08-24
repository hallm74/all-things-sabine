import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const importRoot = path.join(projectRoot, "data/facebook-import/extracted");
const manifestPath = path.join(
  projectRoot,
  "data/facebook-import/image-conversion-manifest.json"
);
const outputRoot = path.join(
  projectRoot,
  "public/facebook-archive/media"
);

const exportNames = ["export-viUXWXE3", "export-YkJZVgrn"];
const mediaSuffix = path.join(
  "this_profile's_activity_across_facebook",
  "posts",
  "media"
);
const imagePattern = /\.(?:jpe?g|png|gif)$/i;

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, files);
    else if (imagePattern.test(entry.name)) files.push(entryPath);
  }
  return files;
}

function toProjectPath(absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

const previous = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { images: [] };
const previousByUri = new Map(
  previous.images.map(image => [image.sourceUri, image])
);

const images = [];
const seenIds = new Map();

for (const exportName of exportNames) {
  const mediaRoot = path.join(importRoot, exportName, mediaSuffix);
  for (const sourcePath of walk(mediaRoot)) {
    const sourceUri = path
      .relative(path.join(importRoot, exportName), sourcePath)
      .split(path.sep)
      .join("/");
    const sourceId = path.basename(sourcePath, path.extname(sourcePath));
    const priorUri = seenIds.get(sourceId);
    if (priorUri && priorUri !== sourceUri) {
      throw new Error(`Duplicate Facebook media ID ${sourceId}`);
    }
    seenIds.set(sourceId, sourceUri);

    const outputPath = path.join(
      outputRoot,
      sourceId.slice(0, 2),
      sourceId.slice(2, 4),
      `${sourceId}.webp`
    );
    const previousImage = previousByUri.get(sourceUri);
    const outputExists = fs.existsSync(outputPath);

    images.push({
      sourceUri,
      sourcePath: toProjectPath(sourcePath),
      sourceId,
      sourceBytes: fs.statSync(sourcePath).size,
      outputPath: toProjectPath(outputPath),
      outputBytes: outputExists ? fs.statSync(outputPath).size : null,
      status: outputExists
        ? "converted"
        : previousImage?.status === "skipped"
          ? "skipped"
          : "pending",
      error: outputExists ? null : previousImage?.error ?? null,
    });
  }
}

images.sort((a, b) => a.sourceUri.localeCompare(b.sourceUri));

const summary = images.reduce(
  (result, image) => {
    result.total += 1;
    result[image.status] += 1;
    result.sourceBytes += image.sourceBytes;
    result.outputBytes += image.outputBytes ?? 0;
    return result;
  },
  {
    total: 0,
    pending: 0,
    converted: 0,
    skipped: 0,
    failed: 0,
    sourceBytes: 0,
    outputBytes: 0,
  }
);

const manifest = {
  version: 1,
  updatedAt: new Date().toISOString(),
  sourceFormat: "Facebook JSON export",
  targetFormat: "WebP",
  summary,
  images,
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
