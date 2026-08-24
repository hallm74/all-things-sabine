import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";
import { slugifyStr } from "./slugify";

export interface TaggableItem {
  id: string;
  kind: "blog" | "facebookArchive";
  href: string;
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
}

export interface UnifiedTag {
  tag: string;
  tagName: string;
}

export function getTaggableItems(
  posts: CollectionEntry<"blog">[],
  stories: CollectionEntry<"facebookArchive">[]
): TaggableItem[] {
  const blogItems = posts.filter(postFilter).map(post => ({
    id: `blog:${post.id}`,
    kind: "blog" as const,
    href: `/posts/${post.id.replace(/\.md$/, "")}/`,
    title: post.data.title,
    description: post.data.description,
    publishedAt: post.data.pubDatetime,
    tags: post.data.tags,
  }));

  const archiveItems = stories
    .filter(story => !story.data.draft)
    .map(story => ({
      id: `facebookArchive:${story.id}`,
      kind: "facebookArchive" as const,
      href: `/facebook-archive/${story.id.replace(/\.md$/, "")}/`,
      title: story.data.title,
      description: story.data.description,
      publishedAt: story.data.publishedAt,
      tags: story.data.tags,
    }));

  return [...blogItems, ...archiveItems].sort(
    (a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf()
  );
}

export function getUniqueTagsFromItems(items: TaggableItem[]): UnifiedTag[] {
  return items
    .flatMap(item => item.tags)
    .map(tagName => ({ tag: slugifyStr(tagName), tagName }))
    .filter(
      (value, index, self) =>
        self.findIndex(candidate => candidate.tag === value.tag) === index
    )
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getItemsByTag(items: TaggableItem[], tag: string) {
  return items.filter(item =>
    item.tags.some(itemTag => slugifyStr(itemTag) === tag)
  );
}
