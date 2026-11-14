# ArtVision X • TwentyX Gallery

A living gallery of artists from the **ArtVision X** community who share a full twenty photos or videos in a single post using the hashtag **#twentyx**.

## What this is
- Automatically updates with new artists who post full 20-media collections
- Displays artist **display names only** (no handles)
- Local-time gradient background that shifts from dawn → day → sunset → night for each visitor
- Welcome mat explaining how to participate
- Twice-daily appreciation posts (6 AM & 6 PM PT) that name the newest artists

## How to participate
1. Create a post on X with **exactly 20 photos or videos**
2. Include the hashtag **#twentyx**
3. Share it in the [ArtVision X community](https://x.com/i/communities/1835009931231322257)

The gallery and appreciation posts will pick it up.

## Live site
Enable GitHub Pages (Settings → Pages → Deploy from branch `main` / root) and the site will be live at:

**https://drksiddh.github.io/twentyx-gallery/**

## Files
- `index.html` — The gallery (loads `artists.json` if present, otherwise uses fallback data)
- `artists.json` — Current list of artists (updated by automations)

## Automations
Two daily automations run at 6:00 AM and 6:00 PM (America/Los_Angeles):
- Search for new #twentyx / 20-media art posts
- Extract display names
- Generate appreciation graphic + post text
- Push updated `artists.json` to this repository

---

Built for the ArtVision X community.
