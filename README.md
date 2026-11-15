# TwentyX • ArtVision X community gallery

A static, publicly auditable gallery of **exactly 20 artworks per admitted X post**.

## Live site and preservation
- Production domain: https://twentyx.artvision.today/
- Hosting: GitHub Pages. No Netlify migration is necessary.
- Historical records: `data/collections.json` is the protected collection archive.
- Published records: `artists.json` powers the frontend and is rebuilt without deleting admitted collections.
- Source credit: original X post, public artist display name, and a one-click follow link.
- Artist permalink: `https://twentyx.artvision.today/?artist=<X-post-id>`.
- Download: each card creates a shareable **PNG QR welcome poster** on demand.
- Repository-generated **SVG welcome graphics** for new artists are committed to `welcome/` at the publication windows.

## Twice-daily schedule
`.github/workflows/publish.yml` checks scheduled triggers at **6 AM and 6 PM America/Los_Angeles** (honoring daylight-saving changes). GitHub Actions schedules may start late or occasionally be skipped; scheduled publication is best-effort, not real-time. A manual `workflow_dispatch` option is also available.

## Critical collection rule
**Search results are not the database.** Never replace `artists.json` or `data/collections.json` with a discovery result, partial collection, temporary placeholder, or empty array.

A trusted importer or human curator must verify that each candidate:
1. Is a post by its credited artist in the **ArtVision X community**.
2. Uses **#TwentyX**.
3. Contains **exactly 20 distinct actual media attachments** (images or videos), not merely 20 guessed URLs, quoted posts or thumbnails.
4. Has an authentic X post URL, correct date and media URLs, and permission to display appropriately.

The existing gallery's data format contains 20 `pbs.twimg.com` image URLs per collection. The first iteration of this rebuild retains that image-only format. **Actual video support and an X community collector have not yet been implemented.** Those require trusted X API access, authorization, and media handling.

## Submit new candidates
A future collector can write to `data/inbox.json`. The publisher accepts JSON objects like:

```json
[
  {
    "name": "Artist Display Name",
    "date": "2026-11-14",
    "postUrl": "https://x.com/artistname/status/1234567890123456789",
    "media": ["20 distinct https://pbs.twimg.com/media/... URLs"]
  }
]
```

The publisher rejects **any** invalid candidate and refuses to shrink the archive. Once candidates are reviewed, run `npm install` and `npm run publish`, or manually start the GitHub Actions workflow. Valid records are merged by original post ID; prior records remain.

**Important:** Structural validation does not independently verify membership in the community, author identity, media completeness from X, or rights. Do not trust arbitrary submissions without an authenticated verification step.

## Collaboration
Send changes by pull request. Keep `main` protected with reviews and required checks once tests are added. Only project maintainers should have write access to production data and workflow configuration. GitHub maintains the full versioned history; community members can fork and contribute without receiving your credentials.

## Known deployment considerations
- Images are hotlinked from X and may become unavailable; preservation requires permission-aware mirroring later.
- Welcome SVG files embed a QR-code image and can be downloaded from GitHub.
- On-site PNG poster generation loads the `qrcode` browser library from jsDelivr. A future revision can self-host the dependency for stronger offline resilience.
- The current collector must be connected separately. The workflow **publishes validated inputs** but does not search X automatically.
- All new features are prepared on a separate branch for review before any production change.

## Gallery v3 • editorial exhibition (review branch)

The `upgrade/gallery-v2` pull request now includes an artist-first interface:

- Dune Rise **ARTVISION X / TWENTYX** display typography; shimmering metallic-style gradients.
- Local visitor time-of-day color shifts (daybreak / day / sunset / night).
- Featured order: Pepavaggio → Stunnifer → Cipher Voss → remaining artists.
- Cleaner hero with **Share your #TwentyX**, closely grouped helper text and a divider above the exhibition.
- Searchable home exhibition cards; each keeps all **20 original image URLs**.
- Full-width, responsive **5-column by 4-row artwork wall** on wide displays (3 on tablet / 2 on mobile).
- Solo artist spotlight with large artist name, compact TwentyX side identity and one-row actions.
- **Spatial carousel**: CSS perspective viewer; original artwork files are not turned into 3D models.
- **Cinema**: fullscreen slideshow for a single artist, an artist selection, or everyone; adjustable autoplay, keyboard arrows, touch swipes, direct X follow links.
- Contextual `i` help dialogs and downloadable on-demand QR welcome PNGs.
- PR validation workflow tests that incomplete submissions cannot overwrite the published archive.

Preview (read-only, third-party): https://rawcdn.githack.com/DrkSiddh/twentyx-gallery/1a807fd55d4af18fec5258b8e166cb6dd4047c90/index.html

**Unfinished:** authenticated X community discovery, native video, true WebGL/3D rooms, camera-based gesture recognition. A published artist permalink QR resolves correctly after the upgraded page reaches the production domain.

**Operational note:** GitHub's automated syntax and archive-safety tests pass, but there has not yet been a visual, cross-browser, or device QA pass. Keep the PR as draft until preview is reviewed.


## Automatic discovery • X API connection

The twice-daily publisher now runs `npm run discover` **before** `npm run publish`. It uses X's official recent search endpoint with `#TwentyX has:media -is:retweet -is:quote`, expands media and author objects, and pages through up to 200 results per scheduled run by default. The oldest window is recent search's last seven days.

**One-time owner setup (required before live discovery):**
1. In the [X Developer Console](https://console.x.com/), create or select an approved project/app with read access and obtain its **Bearer Token**. An X Premium subscription does not automatically supply developer API credentials or usage credits.
2. Go to this GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**. Name it exactly **`X_BEARER_TOKEN`** and paste the token. Never commit it into a file.
3. Merge the reviewed PR into `main` when ready. Then use **Actions → TwentyX sunrise / sunset publisher → Run workflow** for the initial test. Inspect the run log plus `data/discovery-report.json` and `data/review-queue.json`.
4. After the test, leave GitHub Actions enabled. Scheduled runs target **6 AM and 6 PM Pacific**, subject to GitHub scheduling delays. X API read usage may incur charges; set an appropriate spending limit in the X Developer Console.

**Strict admission logic:**
- An X post must contain the actual `#TwentyX` hashtag, belong to community **1835009931231322257**, and have **exactly 20 media keys**.
- The API must return the corresponding twenty **distinct real photo media records** and their valid X image URLs. We do not synthesize placeholders, use quote-post images, or turn a four-image post into twenty.
- X currently does **not** document a Community-only recent-search operator. The collector requests the `community_id` post field, filters for this exact community ID, and **fails closed** when community membership is unavailable. If the API rejects that field, the query is retried without it; such candidates are held in `data/review-queue.json` instead of auto-published.
- Posts with twenty attachments that include video, or have partial media expansions, also go to the review queue until those formats can be supported.
- An unsuccessful API run never overwrites the archive. A successful run merges newly verified records with existing ones.
- `data/inbox.json` is a staging area, not the permanent source of truth. Do not accept submissions via arbitrary untrusted writes to that file.

**Reality check:** The collector is implemented and wired, but it **cannot execute real discovery until the repository owner adds the X API Bearer Token**. We have not verified whether the user's X API tier exposes `community_id` and all twenty expanded media objects, so full hands-off community verification remains conditional on a real API response.

## Collector's Edition • welcome brochure

On publication, `scripts/welcome.mjs` creates a 1080 × 1350 portrait collector brochure per artist under `welcome/` as both **PNG** and **self-contained SVG**. The composition features:

- Iridescent TwentyX wordmark on a dark navy/plum metallic frame.
- Large artist name and authentic X handle, the post date, and 20/20 count.
- **All twenty actual artist images**, fit *inside* their own tiles without cropping; numbered like an exhibition contact sheet.
- A QR code that links to that artist's permanent TwentyX solo page.

The generator retrieves the artist's X-hosted image URLs only to create the share image. If any image is unavailable, it **defers that artist's brochure** instead of inventing an image, and retries on a future run. On-site download prefers the generated brochure PNG; for an artist whose new brochure hasn't been generated, the earlier text-and-QR fallback is still available.

Website Dune Rise typography and the generated graphic's system-font fallback may render differently where the proprietary font is unavailable. Do not commit third-party font files without appropriate licensing.

The historical artist work is not modified. Please follow the original artist's rights and X platform terms when redistributing promotional copies.


## Human-readable artist exhibition URLs

Each artist receives a generated GitHub Pages route at
`https://twentyx.artvision.today/@<lowercase-x-handle>/`, e.g.
`https://twentyx.artvision.today/@stunnifer/`.
`npm run build` writes `@handle/index.html` for every qualified artist.
All assets remain embedded, and paths to dynamic gallery data are root-relative.
On-site links, copy-link, and new brochure QR codes use the readable routes.
Existing `/?artist=<post-id>` links continue working.

If an artist changes their X handle, maintain a static redirect page for the
old @handle to prevent broken shared links.
Visitor-facing help copy omits internal scheduling and publishing caveats.

## Automatic #TwentyX discovery — no paid X API

The twice-daily GitHub Actions publisher calls `npm run discover:free` before the
non-destructive gallery publisher. There is **no X API token requirement**.

Eligibility is deliberately simple: one original X post with `#TwentyX`
and **exactly 20 distinct, real photographic attachments**. Missing community
metadata is not a disqualifier. A retrieved one-image preview is never inflated
to twenty, nor taken as proof that the actual post contained only one.

Discovery tries the public X community/hashtag pages and free FxEmbed search;
individual post images are checked through free FxEmbed and VxTwitter status
lookups. The free source can return 403, 404, partial media, or sparse search
results; no free public source guarantees complete coverage of X community posts.
Every run writes a technical report to `data/discovery-free-report.json`
with source availability, candidate count, admission count and review reasons.
The exhibition itself should **never** display internal reliability warnings.

New qualified records are merged into `data/inbox.json`, then published
to `data/collections.json`, `artists.json`, artist rooms and brochures.
Existing exhibits cannot be deleted by a failed scan. Scheduled execution is
at the same two Pacific-time publication windows.

A green Actions result proves the job completed, **not** that every eligible
X post was discoverable. Check `newExhibitions` and `sourceChecks` in the
report to diagnose upstream access issues.
