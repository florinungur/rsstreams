// Unlisted script the popup injects with `scripting.executeScript`; named to
// avoid WXT's `content` entrypoint type, which registers a manifest content
// script. The resolved value reaches the popup as `InjectionResult.result`.

import type { ChannelInfo, NamedPlaylist } from "@/lib/feed-builder";
import {
    extractInnertubeClient,
    extractYtInitialData,
    type InnertubeClient,
    parsePlaylistsTab,
    playlistsContinuation,
    resolveChannelInfo,
    whenDocumentReady,
} from "@/lib/parse-channel-info";

declare global {
    interface Window {
        ytInitialData?: unknown;
        wrappedJSObject?: { ytInitialData?: unknown };
    }
}

async function fetchPlaylistsTab(channelId: string, signal: AbortSignal): Promise<string | null> {
    const url = `/channel/${channelId}/playlists`;
    const response = await fetch(url, { credentials: "same-origin", signal });
    if (!response.ok) return null;
    return response.text();
}

// The request YouTube's own page makes for the next 30 playlists as you scroll.
// It is answered without cookies, so it carries none.
async function fetchPlaylistsContinuation(
    token: string,
    client: InnertubeClient,
    signal: AbortSignal,
): Promise<unknown> {
    const response = await fetch("/youtubei/v1/browse?prettyPrint=false", {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: { client }, continuation: token }),
        signal,
    });
    if (!response.ok) return null;
    return response.json();
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

// The Playlists tab holds the full list, 30 to a page; the page itself carries at
// most the Home-tab shelves. One deadline covers every page of a channel's list,
// and a page that fails keeps the ones read before it.
async function withPlaylistsTab(info: ChannelInfo): Promise<ChannelInfo> {
    const playlists: NamedPlaylist[] = [];
    const seen = new Set<string>();
    const signal = AbortSignal.timeout(10_000);
    try {
        const html = await fetchPlaylistsTab(info.channelId, signal);
        if (html !== null) {
            const client = extractInnertubeClient(html);
            let page = extractYtInitialData(new DOMParser().parseFromString(html, "text/html"));
            for (;;) {
                const before = playlists.length;
                for (const playlist of parsePlaylistsTab(page)) {
                    if (seen.has(playlist.listId)) continue;
                    seen.add(playlist.listId);
                    playlists.push(playlist);
                }
                const token = playlistsContinuation(page);
                // A page that adds nothing ends the read, so a token that comes
                // back again can't loop.
                if (!token || !client || playlists.length === before) break;
                // oxlint-disable-next-line no-await-in-loop -- each token comes from the page before it
                page = await fetchPlaylistsContinuation(token, client, signal);
            }
        }
    } catch {
        // Keep what was read; with nothing read, the page's own playlists stand.
    }
    return playlists.length > 0 ? { ...info, playlists } : info;
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
