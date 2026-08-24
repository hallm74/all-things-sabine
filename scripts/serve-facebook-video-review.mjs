import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const projectRoot = process.cwd();
const host = process.env.FACEBOOK_VIDEO_REVIEW_HOST || "0.0.0.0";
const port = Number(process.env.FACEBOOK_VIDEO_REVIEW_PORT || 4322);
const importRoot = path.join(projectRoot, "data/facebook-import");
const extractedRoot = path.join(importRoot, "extracted");
const exportRoot = path.join(extractedRoot, "export-viUXWXE3");
const exportRoots = [
  exportRoot,
  ...fs
    .readdirSync(extractedRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(extractedRoot, entry.name))
    .filter(candidate => candidate !== exportRoot),
];
const postsPath = path.join(
  exportRoot,
  "this_profile's_activity_across_facebook/posts/profile_posts_1.json"
);
const manifestPath = path.join(importRoot, "post-import-manifest.json");
const pageSize = 12;

for (const requiredPath of [postsPath, manifestPath]) {
  if (!fs.existsSync(requiredPath)) throw new Error(`Missing ${requiredPath}`);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shorten(value, maximum = 110) {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > maximum
    ? `${oneLine.slice(0, maximum - 1).replace(/\s+\S*$/, "")}…`
    : oneLine;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const rawPosts = JSON.parse(fs.readFileSync(postsPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const videoPosts = manifest.posts
  .filter(post => ["deferred-video", "imported-video"].includes(post.status))
  .map(entry => {
    const source = rawPosts[entry.sourcePostIndex];
    const text = getPostText(source);
    const videoUri = entry.videoUris[0];
    const candidates = exportRoots.map(root => path.resolve(root, videoUri));
    const videoPath =
      candidates.find(
        candidate =>
          fs.existsSync(candidate) && fs.statSync(candidate).size > 0
      ) ?? candidates[0];
    const isInsideAnExport = exportRoots.some(root =>
      videoPath.startsWith(`${path.resolve(root)}${path.sep}`)
    );
    if (!isInsideAnExport) {
      throw new Error(`Unsafe video path in post ${entry.sourcePostIndex}`);
    }
    const size = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
    return {
      ...entry,
      text,
      videoPath,
      size,
      title: shorten(text) || fixFacebookText(entry.facebookTitle) || "Video post",
      date: new Date(entry.sourceTimestamp * 1000),
    };
  })
  .sort((a, b) => b.sourceTimestamp - a.sourceTimestamp);

const byPostIndex = new Map(videoPosts.map(post => [post.sourcePostIndex, post]));
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
  timeZoneName: "short",
});

function renderPagination(page, pageCount, query) {
  const link = number =>
    `/?page=${number}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  return `<nav class="pagination" aria-label="Video pages">
    ${page > 1 ? `<a href="${link(page - 1)}">← Previous</a>` : "<span></span>"}
    <span>Page ${page} of ${pageCount}</span>
    ${page < pageCount ? `<a href="${link(page + 1)}">Next →</a>` : "<span></span>"}
  </nav>`;
}

function renderIndex(url) {
  const query = (url.searchParams.get("q") || "").trim();
  const normalizedQuery = query.toLowerCase();
  const matches = normalizedQuery
    ? videoPosts.filter(post =>
        `${post.title} ${post.text} ${post.facebookTitle}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : videoPosts;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), pageCount);
  const shown = matches.slice((page - 1) * pageSize, page * pageSize);
  const cards = shown
    .map(
      post => `<article class="card">
        <div class="meta">
          <time datetime="${post.date.toISOString()}">${escapeHtml(dateFormatter.format(post.date))}</time>
          <span>${formatBytes(post.size)}</span>
          <span>Post ${post.sourcePostIndex}</span>
        </div>
        <h2>${escapeHtml(post.title)}</h2>
        ${
          post.text
            ? `<p class="post-text">${escapeHtml(post.text)}</p>`
            : '<p class="video-only">No accompanying Facebook text</p>'
        }
        <video controls playsinline preload="metadata" src="/media/${post.sourcePostIndex}">
          Your browser cannot play this exported video.
        </video>
      </article>`
    )
    .join("\n");
  const pagination = renderPagination(page, pageCount, query);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Facebook Video Review</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f8f6; color: #24282b; }
    main { width: min(1120px, calc(100% - 28px)); margin: 0 auto; padding: 38px 0 70px; }
    .eyebrow { color: #0878b8; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 12px 0; color: #0878b8; font-size: clamp(2rem, 6vw, 4.4rem); line-height: .98; }
    .intro { max-width: 760px; font-size: 1.05rem; line-height: 1.6; }
    form { display: flex; gap: 10px; margin: 28px 0 12px; }
    input { min-width: 0; flex: 1; border: 1px solid #c9ced1; border-radius: 7px; padding: 12px 14px; font: inherit; background: white; color: #24282b; }
    button, a { color: #066ca5; }
    button { border: 0; border-radius: 7px; padding: 12px 18px; background: #0878b8; color: white; font: inherit; font-weight: 700; }
    .summary { margin: 10px 0 24px; color: #596066; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
    .card { min-width: 0; overflow: hidden; border: 1px solid #d9dddf; border-radius: 11px; background: white; box-shadow: 0 5px 20px rgb(26 40 48 / 7%); }
    .card h2, .card p, .meta { margin-left: 20px; margin-right: 20px; }
    .card h2 { margin-top: 12px; font-size: 1.22rem; line-height: 1.35; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 18px; color: #687177; font-size: .78rem; text-transform: uppercase; }
    .post-text { max-height: 11.5rem; overflow: auto; white-space: pre-wrap; line-height: 1.55; }
    .video-only { color: #737b80; font-style: italic; }
    video { display: block; width: 100%; max-height: 480px; margin-top: 18px; background: #111; }
    .pagination { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; margin: 30px 0; }
    .pagination a:last-child { justify-self: end; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding-top: 24px; } }
    @media (prefers-color-scheme: dark) {
      body { background: #0c1014; color: #e7ebed; }
      .card { background: #151b20; border-color: #30383e; }
      input { background: #151b20; border-color: #3c464c; color: #e7ebed; }
      .summary, .meta { color: #a7b0b5; }
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Facebook Archive · Local Video Review</div>
    <h1>Deferred videos</h1>
    <p class="intro">These videos stream directly from the private Facebook export on this Mac. They have not been copied into the Astro site or published.</p>
    <form method="get"><input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search original post text…"><button>Search</button></form>
    <p class="summary">Showing ${shown.length} of ${matches.length} matching posts · ${videoPosts.length} total · 357 with text · 8 video-only</p>
    ${pagination}
    <section class="grid">${cards || "<p>No matching videos.</p>"}</section>
    ${pagination}
  </main>
</body>
</html>`;
}

function serveVideo(req, res, post) {
  if (!post || !post.size || !fs.existsSync(post.videoPath)) {
    res.writeHead(404).end("Video not found");
    return;
  }
  const extension = path.extname(post.videoPath).toLowerCase();
  const mimeTypes = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
  };
  const type = mimeTypes[extension] || "application/octet-stream";
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": post.size,
      "Content-Type": type,
    });
    fs.createReadStream(post.videoPath).pipe(res);
    return;
  }
  const match = range.match(/bytes=(\d*)-(\d*)/);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = Math.min(match?.[2] ? Number(match[2]) : post.size - 1, post.size - 1);
  if (!match || start > end || start >= post.size) {
    res.writeHead(416, { "Content-Range": `bytes */${post.size}` }).end();
    return;
  }
  res.writeHead(206, {
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${post.size}`,
    "Content-Type": type,
  });
  fs.createReadStream(post.videoPath, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const mediaMatch = url.pathname.match(/^\/media\/(\d+)$/);
  if (mediaMatch) {
    serveVideo(req, res, byPostIndex.get(Number(mediaMatch[1])));
    return;
  }
  if (url.pathname !== "/") {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(renderIndex(url));
});

server.listen(port, host, () => {
  console.log(`Facebook video review: http://${host}:${port}`);
  console.log(`${videoPosts.length} posts available; press Ctrl+C to stop.`);
});
