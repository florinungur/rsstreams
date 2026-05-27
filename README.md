# <img src="assets/icon.svg" alt="" width="32" valign="middle"> RSStreams for YouTube

Firefox extension that surfaces every RSS/Atom feed reachable from the YouTube page you're on (channel feed, long-form vids / Shorts / Live splits, and playlists) with a copy-to-clipboard button on each row.

Inspired by [teddy-gustiaux/youtube-rss-finder](https://github.com/teddy-gustiaux/youtube-rss-finder), RSStreams is a clean-room rewrite for Manifest V3, TypeScript, and the multi-feed picker UI; no code is copied.

## Why

Because I don't want to have a Google account and RSS is the future.

YouTube's default channel RSS feed includes Shorts. Subscribing in a feed reader pulls every Short alongside long-form videos. The `UULF…` long-form-only playlist solves it, but YouTube doesn't surface it. Same for `UUSH…` (Shorts only) and `UULV…` (Live only).

This extension shows all of them in a popup. Click the toolbar icon on any `youtube.com/@handle`, `/channel/UC…`, `/watch?v=…`, or `/playlist?list=…` page, copy the feed URL you want, paste it into your reader.

## Install

Not yet published on AMO.

## Status

Pre-release. Repo bootstrap done; pure modules, content script, popup UI, and E2E to land in subsequent phases.

## Development

```sh
pnpm install
pnpm wxt:prepare    # generate .wxt/ types after install (scripts are ignored by default)
pnpm dev            # load extension in a temp Firefox profile
pnpm test           # vitest watch mode
pnpm build          # produce .output/firefox-mv3/
```

Lifecycle scripts are blocked globally for supply-chain safety; `wxt prepare` runs explicitly via the `wxt:prepare` script.

Icons live in `assets/icon.svg` (source). Regenerate the PNG set into `public/icon/` with `./scripts/render-icons.sh` (requires `brew install librsvg`).
