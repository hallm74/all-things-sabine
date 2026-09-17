import { useEffect, useMemo, useState } from "react";
import type { LibraryItem } from "../lib/content";

export default function Library({
  initialItems,
  total,
  kind,
}: {
  initialItems: LibraryItem[];
  total: number;
  kind: "stories" | "archive";
}) {
  const [items, setItems] = useState(initialItems),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const [query, setQuery] = useState(""),
    [year, setYear] = useState("all"),
    [page, setPage] = useState(1),
    [order, setOrder] = useState(kind === "archive" ? "photos" : "newest");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/data/${kind}.json`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw Error("Could not load collection");
        return r.json();
      })
      .then(data => {
        setItems(data);
        setReady(true);
      })
      .catch(e => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [kind]);
  const years = useMemo(
    () =>
      [...new Set(items.map(s => new Date(s.date).getFullYear().toString()))]
        .sort()
        .reverse(),
    [items]
  );
  const filtered = useMemo(
    () =>
      items
        .filter(
          s =>
            (year === "all" ||
              new Date(s.date).getFullYear().toString() === year) &&
            `${s.title} ${s.description} ${s.tags.join(" ")} ${s.historicalDate || ""}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase().trim())
        )
        .sort((a, b) =>
          order === "oldest"
            ? a.date.localeCompare(b.date)
            : order === "photos"
              ? Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
                b.date.localeCompare(a.date)
              : b.date.localeCompare(a.date)
        ),
    [items, query, year, order]
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const reset = () => {
    setQuery("");
    setYear("all");
    setPage(1);
  };
  const goPage = (next: number) => {
    setPage(next);
    document.getElementById("browse")?.scrollIntoView({ behavior: "instant" });
  };
  return (
    <div>
      <div className="browse-tools">
        <label className="field search-field">
          Search {kind === "archive" ? "the Time Capsule" : "stories"}
          <input
            type="search"
            placeholder={
              kind === "archive"
                ? "A name, a place, a memory…"
                : "Try Toledo Bend, Toro, or school…"
            }
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            disabled={!ready}
          />
        </label>
        <label className="field">
          {kind === "archive" ? "Facebook posting year" : "Publication year"}
          <select
            value={year}
            onChange={e => {
              setYear(e.target.value);
              setPage(1);
            }}
            disabled={!ready}
          >
            <option value="all">All years</option>
            {years.map(y => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        {kind === "archive" && (
          <label className="field">
            Browse order
            <select
              value={order}
              onChange={e => {
                setOrder(e.target.value);
                setPage(1);
              }}
              disabled={!ready}
            >
              <option value="photos">Photographs first</option>
              <option value="newest">Newest posts first</option>
              <option value="oldest">Oldest posts first</option>
            </select>
          </label>
        )}
        {kind === "archive" && (
          <button
            className="button"
            disabled={!ready || !filtered.length}
            onClick={() => {
              window.location.href =
                filtered[Math.floor(Math.random() * filtered.length)].href;
            }}
          >
            Surprise me ↗
          </button>
        )}
      </div>
      <div className="results-meta" role="status" aria-live="polite">
        <span>
          {error
            ? "The full index could not load. You can still open the memories below."
            : !ready
              ? `${total.toLocaleString()} ${kind === "archive" ? "preserved posts" : "stories"} · Loading search…`
              : `${filtered.length.toLocaleString()} ${kind === "archive" ? "memories" : "stories"}${query || year !== "all" ? " found" : ""} · Page ${page} of ${pages}`}
        </span>
        {(query || year !== "all") && (
          <button onClick={reset}>Clear filters</button>
        )}
        {kind === "archive" && (
          <span>
            Years refer to posting dates; historical dates appear inside each
            entry.
          </span>
        )}
      </div>
      <div className="library-grid">
        {filtered.slice((page - 1) * 24, page * 24).map(item => (
          <article
            key={item.href}
            className={`library-card ${kind === "archive" ? "archive-card" : ""}`}
          >
            <a href={item.href}>
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  width="600"
                  height="400"
                />
              ) : (
                <div className="image-placeholder">
                  {kind === "archive"
                    ? "A memory in words."
                    : "A story worth keeping."}
                </div>
              )}
              <span className="eyebrow">
                {kind === "archive"
                  ? "From the Facebook archive"
                  : item.tags[0] || "From our story collection"}{" "}
                · {new Date(item.date).getFullYear()}
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <span className="text-link">
                {kind === "archive" ? "Open this memory" : "Read the story"} ↗
              </span>
            </a>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <h2>No matches just yet.</h2>
            <p>Try another name or place, or open up all the years.</p>
            <button className="button" onClick={reset}>
              Show everything
            </button>
          </div>
        )}
      </div>
      {pages > 1 && (
        <nav className="pagination" aria-label="Collection pages">
          <button onClick={() => goPage(page - 1)} disabled={page === 1}>
            ← Previous
          </button>
          <span>
            {page} / {pages}
          </span>
          <button onClick={() => goPage(page + 1)} disabled={page === pages}>
            Next →
          </button>
        </nav>
      )}
      <noscript>
        <p className="directory-note">
          Showing the first 24 entries. Enable JavaScript to search and browse
          the full collection.
        </p>
      </noscript>
    </div>
  );
}
