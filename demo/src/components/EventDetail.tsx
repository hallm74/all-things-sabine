import { useEffect, useState } from "react";
import { type CalendarRow, safePublicLink, when } from "../lib/calendar";
export default function EventDetail({initial}: {initial: CalendarRow}) {
  const [event, setEvent] = useState<CalendarRow | null>(initial);
  const [note, setNote] = useState("Checking the latest event details…");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch(`/api/calendar/community-events/${encodeURIComponent(initial.slug!)}/`, {signal: controller.signal}).then(async response => {
      if (response.status === 404) {setEvent(null); setNote("This event is no longer published."); return;}
      if (!response.ok) throw new Error();
      setEvent(await response.json()); setNote("");
    }).catch(() => setNote("Showing the last published details. We couldn’t check for updates; confirm with the organizer."));
    return () => {clearTimeout(timer); controller.abort();};
  }, [initial.slug]);
  return <article className="event-detail"><p role="status">{note}</p>{event && <><p className="eyebrow">{event.category || "Community event"}{event.status === "cancelled" && " · Cancelled"}</p><h1>{event.title}</h1><p>{when(event)}</p><p>{event.location}</p><p className="event-description">{event.description}</p>{event.associations.map(profile => <p key={profile.url}><a href={safePublicLink(profile.url)}>{profile.name} ↗</a></p>)}{event.website && <p><a href={safePublicLink(event.website)}>Organizer’s website / announcement ↗</a></p>}<a className="button" href={`/api/calendar/calendar.ics?from=${event.startsOn}&to=${event.endsOn}&kind=events&id=${encodeURIComponent(event.id)}`}>Download event dates (.ics)</a></>}</article>;
}
