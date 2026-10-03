import type { CalendarRow } from "./calendar";
const origin = process.env.PUBLIC_API_ORIGIN || "https://hallm-menus-api.fly.dev";
let snapshot: Promise<{events: CalendarRow[]; generatedAt: string}> | undefined;
export function getCalendarSnapshot() {
  return snapshot ??= (async () => {
    const response = await fetch(`${origin}/api/calendar/community-events/`, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Event publication failed: HTTP ${response.status}. Deploy the additive calendar API first.`);
    const data = await response.json();
    if (!Array.isArray(data.events) || data.events.some((row: CalendarRow) => !row.slug || !row.id || !row.url)) throw new Error("Incomplete public events snapshot");
    return {events: data.events as CalendarRow[], generatedAt: new Date().toISOString()};
  })();
}
