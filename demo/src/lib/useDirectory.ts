import { useEffect, useState } from "react";
import { normalizeDirectoryItems, type DirectoryItem, type DirectoryKind } from "./directories";
import sources from "./directory-sources.json";

// Share a single request between homepage counts and event previews. A new page
// visit starts fresh; there are no background polling requests.
const requests = new Map<DirectoryKind, Promise<DirectoryItem[]>>();
function loadDirectory(kind: DirectoryKind) {
  if (!requests.has(kind)) {
    const request = fetch(`/api/directories/${kind}?fresh=${Date.now()}`, {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    }).then(async response => {
      if (!response.ok) throw new Error("Directory unavailable");
      const body = await response.json();
      const rows = body[sources[kind].key];
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row.name !== "string" || !row.name || typeof row.slug !== "string" || !row.slug)) {
        throw new Error("Invalid directory response");
      }
      return normalizeDirectoryItems(kind, rows);
    });
    requests.set(kind, request);
  }
  return requests.get(kind)!;
}

export function useDirectory(kind: DirectoryKind, initialItems: DirectoryItem[]) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<"loading" | "live" | "saved">("loading");
  useEffect(() => {
    let active = true;
    setItems(initialItems);
    setStatus("loading");
    loadDirectory(kind).then(rows => {
      if (active) { setItems(rows); setStatus("live"); }
    }).catch(() => { if (active) setStatus("saved"); });
    return () => { active = false; };
  }, [kind, initialItems]);
  return { items, status };
}
