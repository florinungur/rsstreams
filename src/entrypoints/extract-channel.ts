// On-demand script bundled but NOT registered as a `content_scripts` manifest
// entry – injected by the popup via
// `browser.scripting.executeScript({ target, files: ['extract-channel.js'] })`.
// Filename avoids WXT's reserved `content` entrypoint type, which forces a
// manifest content-script registration with `matches`.
//
// Flow:
//   1. Wait for `document.readyState === "complete"` so the inline
//      `<script>var ytInitialData = ` blob has been parsed.
//   2. Resolve `ytInitialData` from `window` (rare in the isolated world),
//      `window.wrappedJSObject` (Firefox bridge), or the page's inline
//      `<script>var ytInitialData = {…};</script>` tag via
//      `extractYtInitialData(document)`.
//   3. `resolveChannelInfo` runs `parseChannelInfo` against the live document
//      and, if that yields nothing, refetches the current URL same-origin so
//      a stale SPA snapshot doesn't masquerade as "not a YouTube page".
//   4. Fetch `/channel/<channelId>/playlists` (same-origin, no CORS) to get
//      the canonical playlist grid – the Home tab only shows a curated
//      subset, and Videos / Shorts / Live / Posts tabs carry no playlists at
//      all. The fetch is best-effort; on failure we fall back to whatever
//      step 3 surfaced.
// `defineUnlistedScript`'s function return value becomes the script's last
// expression, which `executeScript` surfaces on `InjectionResult.result`.

import type { ChannelInfo } from "@/lib/feed-builder";
import {
    extractYtInitialData,
    parsePlaylistsTab,
    resolveChannelInfo,
    whenDocumentReady,
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

// `redirect: "follow"` (the default) is intentional: YouTube redirects
// region-blocked or consent-required pages to `consent.youtube.com`, which is
// a different host and so the cross-origin response is unreadable here. The
// resulting fetch failure surfaces as `null` via the catch in
// `resolveChannelInfo`, which is the correct empty-state outcome. The 3s
// timeout keeps a stalled YouTube response from hanging the popup; the abort
// throws and is caught the same way.
async function fetchCurrentPage(): Promise<string | null> {
    const response = await fetch(location.href, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return response.text();
}

export default defineUnlistedScript(async (): Promise<ChannelInfo | null> => {
    await whenDocumentReady(document);

    const initialYtInitialData =
        window.ytInitialData ??
        window.wrappedJSObject?.ytInitialData ??
        extractYtInitialData(document);

    const info = await resolveChannelInfo({
        initialYtInitialData,
        document,
        fetchCurrentPage,
    });
    if (!info) return null;

    try {
        const tabData = await fetchPlaylistsTab(info.channelId);
        const fullPlaylists = parsePlaylistsTab(tabData);
        if (fullPlaylists.length > 0) {
            return { ...info, playlists: fullPlaylists };
        }
    } catch {
        // Best-effort: fall through to whatever step 3 surfaced.
    }
    return info;
});
