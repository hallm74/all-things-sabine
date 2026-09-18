import { eventDate, type DirectoryItem, type DirectoryKind } from "../lib/directories";
import { useDirectory } from "../lib/useDirectory";

export function DirectoryCount({ kind, initialItems }: {kind: DirectoryKind; initialItems: DirectoryItem[]}) {
  const {items, status} = useDirectory(kind, initialItems);
  const label = {menus: "places to eat", listings: "local businesses", community: items.length === 1 ? "community organization" : "community organizations", festivals: "festivals & events"}[kind];
  return <span>{items.length} {label}{status === "saved" && " · saved count"}</span>;
}

export function UpcomingFestivals({initialItems}: {initialItems: DirectoryItem[]}) {
  const {items, status} = useDirectory("festivals", initialItems);
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "America/Chicago"}).format(new Date());
  const events = items.filter(event => event.date && (event.endDate || event.date) >= today).slice(0, 3);
  return <>
    {status === "saved" && <p className="event-source" role="status">Couldn’t refresh event dates. Showing saved events. <a href="https://festivals.allthingssabine.com/">Check Sabine Festivals ↗</a></p>}
    <div className="event-grid">
      {events.map(event => <a href={event.href} className="event-card" key={event.href}>
        <span className="event-date"><strong>{eventDate(event.date!).split(" ")[1]}</strong>{eventDate(event.date!).split(" ")[0]} {event.date!.slice(0, 4)}</span>
        <div><span className="eyebrow">{event.location}</span><h3>{event.name}</h3><p>{eventDate(event.date!)}{event.endDate && event.endDate !== event.date ? " – " + eventDate(event.endDate) : ""}</p><span className="text-link">See the schedule ↗</span></div>
      </a>)}
      {events.length === 0 && <p>No upcoming dates published yet. <a href="https://festivals.allthingssabine.com/">Explore Sabine Festivals ↗</a></p>}
    </div>
  </>;
}
