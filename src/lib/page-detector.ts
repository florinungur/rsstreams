// Pure URL → PageKind classifier. No DOM, no browser APIs.
// Caller is responsible for filtering to youtube.com hosts before calling.

export type PageKind =
    | { kind: "channel"; channelId: string }
    | { kind: "handle"; handle: string }
    | { kind: "watch"; videoId: string }
    | { kind: "playlist"; listId: string }
    | { kind: "other" };

/**
 * Classify a YouTube URL into one of the page kinds we surface feeds for.
 *
 * Recognised:
 *   /channel/UCxxx        → channel
 *   /@handle              → handle
 *   /watch?v=VIDEO_ID     → watch
 *   /playlist?list=PLxxx  → playlist
 *
 * Anything else → { kind: "other" }.
 */
function firstSegment(path: string): string {
    const slash = path.indexOf("/");
    return slash === -1 ? path : path.slice(0, slash);
}

export function detectPage(url: URL): PageKind {
    const path = url.pathname;

    // /@handle (handle may not be empty)
    if (path.startsWith("/@")) {
        const handle = firstSegment(path.slice(2));
        if (handle.length > 0) {
            return { kind: "handle", handle };
        }
        return { kind: "other" };
    }

    // /channel/UCxxx
    if (path.startsWith("/channel/")) {
        const channelId = firstSegment(path.slice("/channel/".length));
        if (channelId.length > 0) {
            return { kind: "channel", channelId };
        }
        return { kind: "other" };
    }

    // /watch?v=VIDEO_ID
    if (path === "/watch") {
        const videoId = url.searchParams.get("v");
        if (videoId !== null && videoId.length > 0) {
            return { kind: "watch", videoId };
        }
        return { kind: "other" };
    }

    // /playlist?list=PLxxx
    if (path === "/playlist") {
        const listId = url.searchParams.get("list");
        if (listId !== null && listId.length > 0) {
            return { kind: "playlist", listId };
        }
        return { kind: "other" };
    }

    return { kind: "other" };
}
