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
