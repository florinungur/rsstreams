// On-demand script bundled but NOT registered as a `content_scripts` manifest
// entry – injected by the popup via
// `browser.scripting.executeScript({ target, files: ['extract-channel.js'] })`.
// Filename avoids WXT's reserved `content` entrypoint type, which forces a
// manifest content-script registration with `matches`.
//
// Flow:
//   1. Resolve `ytInitialData` from `window` (rare in the isolated world),
//      `window.wrappedJSObject` (Firefox bridge), or the page's inline
//      `<script>var ytInitialData = {…};</script>` tag via
//      `extractYtInitialData(document)`.
//   2. `parseChannelInfo` extracts channel ID + title (and any playlist
//      shelves visible on the Home tab). Returns `null` for unknown pages.
//   3. Fetch `/channel/<channelId>/playlists` (same-origin, no CORS) to get
//      the canonical playlist grid – the Home tab only shows a curated
//      subset, and Videos / Shorts / Live / Posts tabs carry no playlists at
//      all. The fetch is best-effort; on failure we fall back to whatever
//      step 2 surfaced.
// `defineUnlistedScript`'s function return value becomes the script's last
// expression, which `executeScript` surfaces on `InjectionResult.result`.

import type { ChannelInfo } from "@/lib/feed-builder";
import {
    extractYtInitialData,
    parseChannelInfo,
    parsePlaylistsTab,
} from "@/lib/parse-channel-info";

declare global {
    interface Window {
        ytInitialData?: unknown;
        wrappedJSObject?: { ytInitialData?: unknown };
    }
}

async function fetchPlaylistsTab(channelId: string): Promise<unknown> {
    const url = `/channel/${channelId}/playlists`;
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return extractYtInitialData(doc);
}

export default defineUnlistedScript(async (): Promise<ChannelInfo | null> => {
    const ytInitialData =
        window.ytInitialData ??
        window.wrappedJSObject?.ytInitialData ??
        extractYtInitialData(document);

    const info = parseChannelInfo({ ytInitialData, document });
    if (!info) return null;

    try {
        const tabData = await fetchPlaylistsTab(info.channelId);
        const fullPlaylists = parsePlaylistsTab(tabData);
        if (fullPlaylists.length > 0) {
            return { ...info, playlists: fullPlaylists };
        }
    } catch {
        // Best-effort: fall through to whatever the current page yielded.
    }
    return info;
});
