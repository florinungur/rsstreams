// Unlisted script the popup injects with `scripting.executeScript`; named to
// avoid WXT's `content` entrypoint type, which registers a manifest content
// script. The resolved value reaches the popup as `InjectionResult.result`.

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
    const response = await fetch(url, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return extractYtInitialData(doc);
}

async function fetchCurrentPage(): Promise<string | null> {
    const response = await fetch(location.href, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return response.text();
}

// A missing navigation entry counts as navigated: a needless refetch costs
// time and can fail, a stale read shows another channel's feeds.
function navigatedSinceLoad(): boolean {
    const [entry] = performance.getEntriesByType("navigation");
    if (!entry) return true;
    return pageKey(entry.name) !== pageKey(location.href);
}

// Only the path, `v`, and `list` pick the page; YouTube rewrites other query
// parameters in place.
function pageKey(href: string): string {
    const url = new URL(href);
    const params = url.searchParams;
    return [url.pathname, params.get("v"), params.get("list")].join("|");
}

// The Playlists tab holds the full list; the page itself carries at most the
// Home-tab shelves.
async function withPlaylistsTab(info: ChannelInfo): Promise<ChannelInfo> {
    try {
        const tabData = await fetchPlaylistsTab(info.channelId);
        const fullPlaylists = parsePlaylistsTab(tabData);
        if (fullPlaylists.length > 0) {
            return { ...info, playlists: fullPlaylists };
        }
    } catch {
        // Keep the playlists the page itself carried.
    }
    return info;
}

export default defineUnlistedScript(async (): Promise<ChannelInfo[]> => {
    await whenDocumentReady(document);

    const initialYtInitialData =
        window.ytInitialData ??
        window.wrappedJSObject?.ytInitialData ??
        extractYtInitialData(document);

    const channels = await resolveChannelInfo({
        navigatedSinceLoad: navigatedSinceLoad(),
        initialYtInitialData,
        document,
        fetchCurrentPage,
    });
    return Promise.all(channels.map(withPlaylistsTab));
});
