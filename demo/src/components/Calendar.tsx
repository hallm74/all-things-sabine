import { useEffect, useState } from "react";
import { type CalendarRow, centralToday, dateLabel, eventHref, filterRows, safePublicLink, when } from "../lib/calendar";
const kindLabel = {events: "Community event", festivals: "Festival", food: "Food truck / pop-up"};
export default function Calendar() {
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [first, setFirst] = useState(centralToday);
  const [last, setLast] = useState(() => { const day = new Date(centralToday() + "T12:00:00Z"); day.setUTCDate(day.getUTCDate() + 90); return day.toISOString().slice(0,10); });
  const [kind, setKind] = useState(""); const [q, setQ] = useState(""); const [category, setCategory] = useState("");
  const [leadup, setLeadup] = useState(true); const [cancelled, setCancelled] = useState(true);
  const [state, setState] = useState("Loading the community calendar…");
  const [profile, setProfile] = useState("");
  const [profiles, setProfiles] = useState<{kind: string; slug: string; name: string}[]>([]);
  useEffect(() => {
    setProfile(new URLSearchParams(location.search).get("profile") || "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch("/api/calendar/profiles/", {signal: controller.signal}).then(async response => {
      if (!response.ok) return;
      const data = await response.json(); if (Array.isArray(data.profiles)) setProfiles(data.profiles);
    }).catch(() => {});
    return () => {clearTimeout(timer); controller.abort();};
  }, []);
  const [ready, setReady] = useState(false); const [retry, setRetry] = useState(0);
  const validRange = Boolean(first && last && last >= first && (Date.parse(last) - Date.parse(first)) / 86400000 <= 366);
  useEffect(() => {
    setRows([]); setReady(false);
    if (!validRange) { setState("Choose a start and end date, up to 366 days apart."); return; }
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setState("Loading the community calendar…");
    fetch(`/api/calendar/?${new URLSearchParams({from: first, to: last})}`, {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.events)) throw new Error();
      if (!current) return;
      setRows(data.events); setReady(true); setState("");
    }).catch(() => { if (current) setState("The calendar is unavailable. Please try again."); });
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [first, last, retry, validRange]);
  const filtered = filterRows(rows, {kind, q, category, leadup, cancelled, profile});
  const params = new URLSearchParams({from: first, to: last, kind, q, category, profile, leadup: String(leadup), cancelled: String(cancelled)});
  const groups = [...new Set(filtered.map(row => row.startsOn))];
  return <section className="central-calendar" aria-label="Community calendar">
    <div className="calendar-filters"><label>Search<input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, place, organizer…" /></label>
    <label>From<input type="date" value={first} onChange={e => setFirst(e.target.value)} /></label><label>Through<input type="date" value={last} onChange={e => setLast(e.target.value)} /></label>
    <label>Type<select value={kind} onChange={e => {setKind(e.target.value); setCategory("");}}><option value="">Everything</option><option value="events">Community events</option><option value="festivals">Festivals</option><option value="food">Food trucks & pop-ups</option></select></label>
    <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{[...new Set(rows.filter(r => !kind || r.kind === kind).map(r => r.category))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Organizer or venue<select value={profile} onChange={e => setProfile(e.target.value)}><option value="">All profiles</option>{profile && !profiles.some(p => `${p.kind}:${p.slug}` === profile) && <option value={profile}>Linked profile</option>}{profiles.map(p => <option key={`${p.kind}:${p.slug}`} value={`${p.kind}:${p.slug}`}>{p.name}</option>)}</select></label>
    <label className="check"><input type="checkbox" checked={leadup} onChange={e => setLeadup(e.target.checked)} /> Include festival lead-up days</label>

    <label className="check"><input type="checkbox" checked={cancelled} onChange={e => setCancelled(e.target.checked)} /> Show cancellations</label>
    <button className="button" onClick={() => {setKind(""); setCategory(""); setQ(""); setLeadup(true); setCancelled(true); setProfile("");}}>Clear filters</button>
    {ready && <a className="button" href={`/api/calendar/calendar.ics?${params}`}>Download these dates (.ics)</a>}</div>
    <p role="status" aria-live="polite">{state || `${filtered.length} upcoming ${filtered.length === 1 ? "entry" : "entries"} · All times Central`}</p>
    {state.includes("unavailable") && <button className="button" onClick={() => setRetry(value => value + 1)}>Try again</button>}
    {ready && !filtered.length && <p>No events match these dates and filters. <a href="/submit/events/">Know something coming up? Submit it for review.</a></p>}
    {groups.map(day => <section key={day} className="calendar-date-group"><h2>{dateLabel(day)}</h2>{filtered.filter(row => row.startsOn === day).map(row => <article key={row.id} className="calendar-event">
      <p className="eyebrow">{kindLabel[row.kind]}{row.leadup && " · Lead-up"}{row.status === "cancelled" && " · Cancelled"}</p><h3><a href={eventHref(row)}>{row.title}</a></h3>
      {row.parent && <p>{row.parent}</p>}<p>{when(row)}</p><p>{row.location}</p>{row.description && <p>{row.description}</p>}
      {row.associations.map(profile => <p key={profile.url}><a href={safePublicLink(profile.url)}>{profile.name} ↗</a></p>)}
      <a href={eventHref(row)}>Details & source schedule →</a></article>)}</section>)}
  </section>;
}
