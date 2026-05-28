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

Pre-release. Repo bootstrap, pure modules, popup UI, content-script scraping, and E2E + a nightly selector canary are done. AMO submission (icons, screenshots, listing) is the remaining phase.

## Development

```sh
pnpm install
pnpm wxt:prepare    # generate .wxt/ types after install (scripts are ignored by default)
pnpm dev            # load extension in a temp Firefox profile
pnpm test           # vitest watch mode
pnpm test:run       # unit tests + 100% coverage gate
pnpm build          # produce .output/firefox-mv3/
pnpm e2e            # build the e2e variant + run the Selenium suite (needs Firefox)
pnpm test:canary    # live-network probe: re-fetch YouTube, assert selectors still work
```

Lifecycle scripts are blocked globally for supply-chain safety; `wxt prepare` runs explicitly via the `wxt:prepare` script.

### End-to-end tests

`e2e/` drives stock Firefox with Selenium (`selenium-webdriver`; Selenium Manager auto-resolves geckodriver, so there's no `geckodriver` dependency). A real toolbar click can't open the popup in automated Firefox, so the suite pins the extension UUID via a profile pref and navigates straight to `moz-extension://<uuid>/popup.html?tabId=<tab>`.

`executeScript` only injects on hosts the manifest grants, so `pnpm build:e2e` (`wxt build --mode e2e`) produces a **test-only** variant in `.output/firefox-mv3-e2e/` that additionally grants `http://127.0.0.1/*`, letting the suite inject into a locally-served fixture instead of hitting live YouTube. The production build (`pnpm build`) stays `youtube.com`-only and is the one submitted to AMO.

### Selector canary

YouTube ships layout changes silently. `pnpm test:canary` re-fetches a few live pages and asserts the ytInitialData parser and DOM selector chain still resolve a channel. It runs nightly in CI (`.github/workflows/selector-canary.yml`) and files a single tracking issue when it goes red — early warning before users hit an empty popup. It's excluded from `pnpm test:run` so the unit suite stays offline and deterministic.

Icons live in `assets/icon.svg` (source). Regenerate the PNG set into `public/icon/` with `./scripts/render-icons.sh` (requires `brew install librsvg`).
