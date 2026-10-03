export type CalendarRow = {
  id: string; title: string; kind: "events" | "festivals" | "food"; category: string;
  location: string; startsOn: string; endsOn: string; start: string | null; end: string | null;
  allDay: boolean; status: "scheduled" | "cancelled"; url: string; description: string;
  updatedAt: string; slug?: string; website?: string; parent?: string; timeLabel?: string;
  leadup: boolean; associations: {name: string; kind: string; slug: string; url: string}[];
};
export const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(new Date(value + "T12:00:00Z"));
export function when(row: CalendarRow): string {
  const days = dateLabel(row.startsOn) + (row.endsOn !== row.startsOn ? ` – ${dateLabel(row.endsOn)}` : "");
  if (row.allDay) return `${days} · ${row.timeLabel || "All day"}`;
  const clock = (value: string) => new Intl.DateTimeFormat("en-US", {hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"}).format(new Date(value));
  return `${days} · ${clock(row.start!)}${row.end ? ` – ${clock(row.end)}` : ""} Central`;
}
export function centralToday() {
  const parts = new Intl.DateTimeFormat("en-US", {year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago"}).formatToParts(new Date());
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function safePublicLink(value: string): string | undefined {
  try { const u = new URL(value); if (["http:", "https:"].includes(u.protocol) && !u.username && !u.password) return u.href; } catch {}
}
export function eventHref(row: CalendarRow) {
  return row.kind === "events" && row.slug ? `/events/${encodeURIComponent(row.slug)}/` : safePublicLink(row.url);
}
export function filterRows(rows: CalendarRow[], filters: {kind: string; q: string; category: string; leadup: boolean; cancelled: boolean; profile?: string}) {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return (!filters.kind || row.kind === filters.kind) && (!filters.category || row.category === filters.category)
      && (!filters.profile || row.associations.some(p => `${p.kind}:${p.slug}` === filters.profile))
      && (filters.leadup || !row.leadup) && (filters.cancelled || row.status !== "cancelled")
      && (!filters.q || [row.title, row.location, row.description, row.parent || "", ...row.associations.map(p => p.name)].join(" ").toLowerCase().includes(filters.q.toLowerCase()));
  });
}
