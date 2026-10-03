# All Things Sabine website

Astro + React website for **https://allthingssabine.com**.
The separate design preview remains at **https://demo.allthingssabine.com**.

## Production

From the repository root, `npm run build` prepares content and builds the
production edition into `demo/dist`. The root `netlify.toml` selects that folder.
The production edition enables indexing, sitemap/RSS, and the existing GA4
property G-B880HYJ0BY; removes preview labels; preserves Facebook media; and
redirects legacy story/archive URLs to the revised routes.

Production Netlify site: `allthingssabine`
(`f163650f-cf00-44b7-90b8-f0d8921e5374`), Git branch `master`.
The previous production deploy is `6a9039f31864a50008a68582` (August 27, 2026);
it can be restored through Netlify if rollback is needed. Legacy source remains
in `src/`, and `npm run build:legacy` rebuilds it into `dist`.

`npm --prefix demo run build` keeps the preview edition and noindex protection.
Do not publish that command’s output to production.

## Local development

This demo uses the existing parent repository's installed Astro 4 / React 18
toolchain. From the repository root:

```sh
npm ci
npm --prefix demo run prepare
npm --prefix demo run dev
```

The development and preview port is 4337. Run checks and build with:

```sh
npm --prefix demo run check
npm --prefix demo run build
npm --prefix demo run preview
```

`prepare` reads the original Markdown content without editing it. It includes
non-draft core stories and only archive entries explicitly marked `draft: false`.
It prepares optimized local story photographs, HTML content, and search indexes.
Generated content and photographs are ignored by Git and recreated by `prepare`.
Archive media continues to use the original site's existing public media URLs.
YouTube embeds are retained; scripts and unsafe HTML attributes are removed.

## Design and routes

- `/`: editorial homepage with featured stories, the four local projects,
  photographic Time Capsule, and upcoming festival previews.
- `/stories/`: searchable original collection with publication-year filters.
- `/stories/:slug/`: full original articles and photographs.
- `/time-capsule/`: archive search, posting-year filters, browse order, pagination,
  and random discovery. Historical dates remain distinct from posting dates.
- `/time-capsule/:slug/`: archive text, photograph galleries, and available videos.
- `/menus/`, `/listings/`, `/community/`, `/festivals/`: React browsing of public
  directory snapshots; full profiles and services open on their existing sites.
- `/about/`: background and demo context.

The four directory snapshots were retrieved September 17, 2026. To refresh them,
run `node demo/scripts/refresh-directories.mjs` from the repository root, update
the displayed snapshot date in `src/pages/[directory].astro`, and rebuild.
This performs finite public reads; there is no browser polling or always-on worker.
Submission links go to existing services. The demo does not write production data.

## Deployment

- Separate Netlify site: `allthingssabine-demo`
- Site ID: `f929fa9c-bcea-4542-9ccc-3fa962a7a412`
- Custom hostname: `demo.allthingssabine.com`
- Publish folder: `demo/dist`
- DNS: demo-only CNAME to `allthingssabine-demo.netlify.app`
- No Git-based production cutover is configured for this demo.

All demo HTML carries `noindex, nofollow`; Netlify applies `X-Robots-Tag` via
`public/_headers`, and robots.txt disallows crawling. Production analytics are not
included. This is a publicly accessible demo, not an authenticated private site.

## Verification for the first demo

- 93 core stories and 3,731 published archive entries; 3,833 HTML pages.
- Astro type checks and production build pass.
- Static route and image-reference validation across every generated HTML page.
- Browser checks: desktop and 390px mobile layouts, archive keyword/year filters,
  menu category filter, festival date view, empty states, and clearing filters.
- Public profile, directory image, and submission links checked against existing
  services. Archive photographs verified in the browser (the original site's
  Cloudflare layer can reject command-line HEAD requests).

Live verification: September 17, 2026. Netlify deploy `6aac05d1104bec4ce2baed27`
reached `ready`; HTTPS is issued and enforced. All 12 checked public routes returned
200 with the noindex header, and archive keyword search was verified on the live
domain. The homepage was opened for review.

## Community calendar and submissions

The main navigation and footer now expose **Calendar** and **Submit**. `/submit/`
offers Events, Businesses, Menus, Festivals and Organizations. The latter four
retain their sister-site forms; `/submit/events/` uses the same directory-bound
email-code verification and private review queue for general community events.
No password, extra account, direct Supabase access or automatic publication is added.

`/calendar/` reads the shared public calendar API on each visit, combines approved
community events, festival days/activities and mobile restaurant stops, and supports
dates, types, categories, search, organizer/venue links, lead-up days, cancellations
and filtered ICS downloads. Association filters may be linked as
`/calendar/?profile=listings:business-slug` (also `menus` and `community`).
`/events/` and `/events/{slug}/` are static reviewed event pages. Details check the
live public API for updates/unpublication. Repeating events use separate reviewed
occurrences; additional requested dates remain in private review notes.

Builds fetch the public event list from the existing Fly backend, or
`PUBLIC_API_ORIGIN` for an isolated local API. A failed event snapshot stops the
build and preserves the last successful deployment. Deploy the additive backend
calendar API/migrations before building the main release. A new
`NETLIFY_EVENTS_BUILD_HOOK` points to this existing main site; published event,
source or relevant profile edits request a batched main rebuild after commit.
No private intake fields are included in the snapshot or HTML.

The event intake component under `src/lib/submissions/` is a release copy of the
Menus repository's shared verified-email component. Keep these copies synchronized
when changing the flow. It ships independently: production never imports a sibling
checkout. The pinned jsdom dev dependency supports portable calendar tests:

```sh
npm --prefix demo run check
npm --prefix demo test
PUBLIC_API_ORIGIN=http://127.0.0.1:8007 npm --prefix demo run build:production
```

The local test build includes disposable preview fixtures and must not be deployed.
Rebuild from the real public API after backend deployment approval. Production
proxy routes are limited to the public calendar, existing code/verify endpoints,
and the Events intake endpoint. No new production domain permission is granted.
