import content from "../data/content.json";
export const stories = content.stories;
export const archive = content.archive as unknown as ArchiveItem[];
export const readableDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(date));
export const storyBy = (text: string) =>
  stories.find(s => s.slug.includes(text))!;
export type LibraryItem = {
  title: string;
  description: string;
  date: string;
  tags: string[];
  image: string;
  href: string;
  historicalDate?: string;
};
export type ArchiveItem = LibraryItem & {
  slug: string;
  html: string;
  media: {
    src: string;
    alt: string;
    width: number;
    height: number;
    caption?: string;
  }[];
  video: { src: string; mimeType: string } | null;
};
