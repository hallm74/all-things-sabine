import fs from "node:fs/promises";

// Public read-only snapshots. A failed source leaves the existing snapshot intact.
const sources = [
  [
    "menus",
    "restaurants",
    "https://menus.allthingssabine.com/api/restaurants/",
  ],
  [
    "listings",
    "listings",
    "https://listings.allthingssabine.com/api/listings/",
  ],
  [
    "community",
    "organizations",
    "https://community.allthingssabine.com/api/community/organizations/",
  ],
  ["festivals", "festivals", "https://hallm-menus-api.fly.dev/api/festivals/"],
];
const results = await Promise.all(
  sources.map(async ([name, key, url]) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
    const body = await response.json();
    if (
      !Array.isArray(body[key]) ||
      body[key].some(item => !item.name || !item.slug)
    )
      throw Error(`${name}: invalid public snapshot`);
    return [name, body[key]];
  })
);
const target = new URL("../src/data/directories.json", import.meta.url);
const temporary = new URL(
  "../src/data/directories.pending.json",
  import.meta.url
);
await fs.writeFile(
  temporary,
  JSON.stringify(Object.fromEntries(results), null, 2) + "\n"
);
await fs.rename(temporary, target);
console.log(
  "Public directory snapshots refreshed. Update the displayed snapshot date before rebuilding."
);
