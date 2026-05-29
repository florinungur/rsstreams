# AMO listing copy

Ready-to-paste metadata for the addons.mozilla.org Developer Hub submission. Keep this in sync with `manifest.json` and `PRIVACY.md` on each release.

## Identity

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Name           | RSStreams for YouTube                                                 |
| Add-on slug    | `rsstreams-for-youtube`                                               |
| Final URL      | https://addons.mozilla.org/en-US/firefox/addon/rsstreams-for-youtube/ |
| Gecko ID       | `rsstreams@florinungur.com`                                           |
| License        | MIT                                                                   |
| Support site   | https://github.com/florinungur/rsstreams                              |
| Support email  | florin@florinungur.com                                                |
| Privacy policy | https://github.com/florinungur/rsstreams/blob/main/PRIVACY.md         |
| Homepage       | https://github.com/florinungur/rsstreams                              |

## Categories (pick 2 max)

- Photos, Music & Videos
- Feeds, News & Blogging

(There is no "Productivity" category for Firefox add-ons – that's Chrome-only.)

## Summary (≤ 250 chars)

> Click the icon on any YouTube page to copy RSS/Atom feed URLs: channel uploads, long-form videos only, Shorts only, Live only, or any named playlist.

## Description (≤ 15000 chars)

> RSStreams finds every RSS/Atom feed reachable from the YouTube page you're on and lets you copy the one you want with a click.
>
> YouTube still publishes RSS feeds, but it hides most of them. The default channel feed mixes in every Short. The long-form-only, Shorts-only, and Live-only feeds exist but aren't linked anywhere, and per-playlist feeds need a hand-built URL. RSStreams surfaces all of them.
>
> Open any channel, handle, video, or playlist page, click the toolbar icon, and the popup lists:
>
> - All uploads (the channel's default feed)
> - Videos, long-form only – no Shorts
> - Shorts only
> - Live only
> - One row per public playlist on the channel
>
> Each row has a Copy button. Paste the URL into your feed reader and you're subscribed – no Google account, no leaving YouTube, no pasting URLs into a separate web tool.
>
> Why long-form-only matters: subscribing to a channel's default RSS feed pulls every Short alongside real videos. The long-form feed fixes that, but YouTube doesn't show it to you. RSStreams does.
>
> Privacy: RSStreams collects nothing, has no analytics, and contains no remote code. It reads a YouTube page only when you click the icon, and the only network request it makes is to YouTube itself, to list a channel's public playlists. Nothing is sent to me or any third party. Full policy: https://github.com/florinungur/rsstreams/blob/main/PRIVACY.md
>
> Permissions: access to youtube.com (it only works there), reading the page when you click the icon (scripting), and clipboard write (to copy a URL). Nothing else.
>
> Open source under the MIT license: https://github.com/florinungur/rsstreams
>
> Credit: inspired by teddy-gustiaux/youtube-rss-finder. RSStreams is a clean-room rewrite for Manifest V3 with a multi-feed picker; no code is copied.

## Data collection (AMO structured disclosure)

Select **"Does not collect any data."** Matches `data_collection_permissions: { required: ["none"] }` in the manifest.

## Reviewer notes

> Clean-room rewrite of teddy-gustiaux/youtube-rss-finder (MIT, dormant since 2020); no code copied.
>
> Build (Node 26, pnpm 11.3.0), from the attached sources zip:
>
>     pnpm install --frozen-lockfile
>     pnpm wxt:prepare
>     pnpm build
>
> Output lands in `.output/firefox-mv3/` and matches the uploaded package. Built with WXT 0.20.26 + Vite. Lifecycle scripts are disabled globally (pnpm `ignoreScripts`), so `wxt prepare` is run explicitly.
>
> No remote code, no eval, no obfuscation. Minified by the bundler; original sources are in the zip.
>
> Notes on behaviour:
>
> - The long-form / Shorts / Live feed URLs use undocumented YouTube playlist-ID prefixes (UULF / UUSH / UULV). They can return empty feeds for channels with no such content; the popup marks those rows rather than failing.
> - To enumerate a channel's playlists, the content script fetches that channel's public `/playlists` page same-origin from within the YouTube tab. No third-party requests.

## Source code submission

Required (we use a bundler). Upload `.output/rsstreams-0.1.0-sources.zip` (produced by `pnpm zip`). It contains the full source, `package.json`, `pnpm-lock.yaml`, and `wxt.config.ts`; it excludes `node_modules`, `.output`, `coverage`, and dotfiles.

## Screenshots (1280×800, ~1.6:1)

1. Popup open on `/@MKBHD` showing the 4 system rows + the Playlists section.
2. Popup open on a `/watch?v=…` page (cross-page support).
3. Mid-copy: the "Copied" flash on a button.
4. Popup open on `/playlist?list=…`.
5. Optional: dark-mode popup.
