export function latestPublished<T extends {date: string; href: string; draft?: boolean}>(items: T[], now = Date.now()): T[] {
  return items.filter(item => !item.draft && Number.isFinite(Date.parse(item.date)) && Date.parse(item.date) <= now)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.href.localeCompare(b.href))
    .slice(0, 5);
}
// The story frontmatter records publication dates; preserve the printed day.
export const newsDate = (date: string) => new Intl.DateTimeFormat("en-US", {
  month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
}).format(new Date(date));
