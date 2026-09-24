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
    const response = await fetch(url, { credentials: "same-origin" });
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
        // Keep the playlists the page itself carried.
    }
    return info;
});
