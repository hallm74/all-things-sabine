import { useState } from "react";
import type { DirectoryItem, DirectoryKind } from "../lib/directories";
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(date + "T12:00:00Z"));

export default function Directory({
  items,
  kind,
  action,
}: {
  items: DirectoryItem[];
  kind: DirectoryKind;
  action: string;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [view, setView] = useState("cards");
  const categories = [...new Set(items.map(x => x.category))];
  const filtered = items.filter(
    item =>
      (category === "all" || item.category === category) &&
      `${item.name} ${item.description} ${item.location} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
  );
  return (
    <div>
      <div className="browse-tools">
        <label className="field search-field">
          Search {kind}
          <input
            type="search"
            value={query}
            placeholder="Search by name, place, or keyword…"
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        {categories.length > 1 && (
          <label className="field">
            Category
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="results-meta" role="status" aria-live="polite">
        <span>
          {filtered.length} of {items.length}{" "}
          {kind === "festivals"
            ? "festivals & events"
            : kind === "menus"
              ? "places to eat"
              : "local profiles"}
        </span>
        {(query || category !== "all") && (
          <button
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {kind === "festivals" && (
        <div className="festival-switch" aria-label="Festival display">
          <button
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            Discover
          </button>
          <button
            aria-pressed={view === "dates"}
            onClick={() => setView("dates")}
          >
            By date
          </button>
        </div>
      )}
      <div className={view === "dates" ? "calendar-list" : "directory-grid"}>
        {filtered.map(item =>
          view === "dates" ? (
            <article className="calendar-event" key={item.href}>
              <div className="event-date">
                <strong>{item.date?.slice(8)}</strong>
                {new Date(item.date + "T12:00:00Z").toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    year: "numeric",
                    timeZone: "America/Chicago",
                  }
                )}
              </div>
              <div>
                <span className="eyebrow">{item.location}</span>
                <h2>{item.name}</h2>
                <p>
                  {formatDate(item.date!)}
                  {item.endDate !== item.date
                    ? " – " + formatDate(item.endDate!)
                    : ""}
                </p>
              </div>
              <a className="text-link" href={item.href}>
                Full schedule ↗
              </a>
            </article>
          ) : (
            <article className="directory-card" key={item.href}>
              {item.image && (
                <img
                  src={item.image}
                  alt={`${item.name} ${kind === "menus" ? "menu" : kind === "festivals" ? "event image" : ""}`}
                  loading="lazy"
                  width="600"
                  height="440"
                />
              )}
              <div className="directory-copy">
                <span className="eyebrow">{item.category}</span>
                <h2>{item.name}</h2>
                <span className="location">{item.location}</span>
                {item.date && (
                  <div className="date-range">
                    {formatDate(item.date)}
                    {item.endDate !== item.date
                      ? " – " + formatDate(item.endDate!)
                      : ""}
                  </div>
                )}
                <p>{item.description}</p>
                <a className="text-link" href={item.href}>
                  {action} ↗
                </a>
                {item.phoneUrl && (
                  <a className="phone" href={item.phoneUrl}>
                    {item.phone}
                  </a>
                )}
              </div>
            </article>
          )
        )}
        {filtered.length === 0 && (
          <div className="empty-state">
            <h2>No matches this time.</h2>
            <p>Try a different search or browse all local profiles.</p>
            <button
              className="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
