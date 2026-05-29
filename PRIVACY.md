# Privacy Policy

**RSStreams for YouTube collects nothing, sends nothing to me, and has no analytics, telemetry, accounts, or remote code.**

Everything the extension does happens locally in your browser. Here's the detail.

## What it reads

When you click the toolbar icon on a YouTube page, the extension reads that page to work out which RSS/Atom feeds are available:

- The page's `ytInitialData` (the JSON YouTube already embeds in the page) and, as a fallback, the page's HTML, to find the channel ID, channel title, and playlists.
- The current tab's URL, to decide whether you're on a channel, handle, watch, or playlist page.

It only reads the page when you click the icon. It does not run in the background, does not watch your browsing, and does not touch pages on any site other than `youtube.com`.

## What it does with what it reads

It builds a list of feed URLs (channel uploads, long-form, Shorts, Live, and per-playlist) and shows them in the popup. When you click a row's Copy button, the feed URL is written to your clipboard. That's the only thing that ever leaves the extension, and only because you asked for it.

## Network requests

The extension makes no requests to any server I control, and none to any third party.

The one request it does trigger goes to YouTube itself – the same site you're already on. To list every public playlist on a channel, it fetches that channel's public playlists page (the same page you'd see at `youtube.com/@channel/playlists`) from within the YouTube tab. That request carries whatever cookies your browser already sends to YouTube; I never see it, and no data is sent anywhere new.

## Permissions, and why

- **`scripting`** – to read the YouTube page (its `ytInitialData`/DOM) when you click the icon, so the popup can list the right feeds.
- **`clipboardWrite`** – to copy a feed URL when you click Copy.
- **Access to `youtube.com`** – the extension only works on YouTube, so it only asks for access to YouTube.

## Data collection

None. The extension declares `data_collection_permissions: { required: ["none"] }` in its manifest. No personal data, browsing history, or usage data is collected, stored, or transmitted.

## Changes

If this ever changes, the policy here will change with it, in the same git history as the code. The version you installed corresponds to the `PRIVACY.md` at that tag.

## Contact

Questions or concerns: open an issue at <https://github.com/florinungur/rsstreams/issues>.
