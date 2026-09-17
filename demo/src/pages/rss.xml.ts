import rss from "@astrojs/rss";
import { stories } from "../lib/content";
import type { APIContext } from "astro";
export function GET(context: APIContext) {
  return rss({
    title: "All Things Sabine",
    description:
      "Stories from Sabine Parish, Louisiana, and our neighbors along the way.",
    site: context.site!,
    items: stories.map(story => ({
      title: story.title,
      description: story.description,
      pubDate: new Date(story.date),
      link: story.href,
    })),
  });
}
