import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, "content/facebook-archive");
const sourcePath = path.join(
  projectRoot,
  "data/facebook-import/extracted/export-viUXWXE3/this_profile's_activity_across_facebook/posts/profile_posts_1.json"
);
const sourcePosts = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const summary = { status: 0, sharedLink: 0, sharedPostUnavailable: 0 };

for (const name of fs.readdirSync(contentRoot).sort()) {
  if (!name.endsWith(".md")) continue;
  const contentPath = path.join(contentRoot, name);
  const raw = fs.readFileSync(contentPath, "utf8");
  const parsed = matter(raw);
  if (!parsed.data.draft || parsed.data.media?.length !== 0) continue;
  if (/^facebookActivityType:/m.test(raw)) continue;

  const source = sourcePosts[parsed.data.sourcePostIndex];
  const urls = (source?.attachments ?? []).flatMap(attachment =>
    (attachment.data ?? [])
      .map(item => item.external_context?.url)
      .filter(Boolean)
  );
  let annotation = "facebookActivityType: status";
  summary.status += 1;

  if (source?.title?.includes("shared a link")) {
    annotation = "facebookActivityType: shared-link";
    if (urls[0]) annotation += `\nsharedUrl: ${JSON.stringify(urls[0])}`;
    summary.status -= 1;
    summary.sharedLink += 1;
  } else if (source?.title?.includes("shared a post")) {
    annotation =
      "facebookActivityType: shared-post\nsharedAttachmentUnavailable: true";
    summary.status -= 1;
    summary.sharedPostUnavailable += 1;
  }

  const updated = raw.replace(
    /^(facebookTitle:.*)$/m,
    `$1\n${annotation}`
  );
  if (updated === raw) throw new Error(`Could not annotate ${name}`);
  fs.writeFileSync(contentPath, updated);
}

console.log(JSON.stringify(summary, null, 2));
