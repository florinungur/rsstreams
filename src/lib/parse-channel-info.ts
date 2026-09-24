import type { ChannelInfo, NamedPlaylist } from "./feed-builder";
import { extractDomChannel, extractDomTitle } from "./selectors";
import { asListId, type ChannelId, isChannelId, type ListId } from "./youtube-ids";

export interface ParseChannelInfoInput {
    /** Parsed value of `window.ytInitialData` from the YouTube page. */
    ytInitialData?: unknown;
    /** Live document, used as the DOM-fallback source. */
    document?: Document;
}

export function parseChannelInfo(input: ParseChannelInfoInput): ChannelInfo | null {
    const fromJson = parseFromYtInitialData(input.ytInitialData);
    if (fromJson) return fromJson;

    if (input.document) {
        const fromDom = parseFromDom(input.document);
        if (fromDom) return fromDom;
    }

    return null;
}

function parseFromYtInitialData(ytInitialData: unknown): ChannelInfo | null {
    if (!isRecord(ytInitialData)) return null;

    const owner = findChannelOwner(ytInitialData);
    if (!owner) return null;

    const playlists = findNamedPlaylists(ytInitialData);
    return {
        channelId: owner.channelId,
        channelTitle: owner.channelTitle,
        playlists,
    };
}

interface OwnerHit {
    channelId: ChannelId;
    channelTitle: string;
}

function findChannelOwner(data: Record<string, unknown>): OwnerHit | null {
    // Channel / handle / browse pages keep the owner in metadata.
    const metadata = readPath(data, ["metadata", "channelMetadataRenderer"]);
    if (isRecord(metadata)) {
        const channelId = pickString(metadata["externalId"]);
        const channelTitle = pickString(metadata["title"]);
        if (channelId && channelTitle && isChannelId(channelId)) {
            return { channelId, channelTitle };
        }
    }

    // Watch + playlist pages bury the owner in a deep `videoOwnerRenderer`.
    return findVideoOwner(data);
}

function findVideoOwner(node: unknown): OwnerHit | null {
    if (isRecord(node)) {
        const renderer = node["videoOwnerRenderer"];
        if (isRecord(renderer)) {
            const channelId = pickString(
                readPath(renderer, ["navigationEndpoint", "browseEndpoint", "browseId"]),
            );
            const channelTitle = pickFirstRun(renderer["title"]);
            if (channelId && channelTitle && isChannelId(channelId)) {
                return { channelId, channelTitle };
            }
        }
        for (const value of Object.values(node)) {
            const hit = findVideoOwner(value);
            if (hit) return hit;
        }
    } else if (Array.isArray(node)) {
        for (const value of node) {
            const hit = findVideoOwner(value);
            if (hit) return hit;
        }
    }
    return null;
}

function findNamedPlaylists(data: Record<string, unknown>): NamedPlaylist[] {
    // The Home tab is index 0; only its shelves linking a playlist (`VL…`) count.
    const sections = readPath(data, [
        "contents",
        "twoColumnBrowseResultsRenderer",
        "tabs",
        0,
        "tabRenderer",
        "content",
        "sectionListRenderer",
        "contents",
    ]);
    if (!Array.isArray(sections)) return [];

    const out: NamedPlaylist[] = [];
    const seen = new Set<string>();
    for (const section of sections) {
        const items = readPath(section, ["itemSectionRenderer", "contents"]);
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            const shelf = readPath(item, ["shelfRenderer"]);
            if (!isRecord(shelf)) continue;
            const browseId = pickString(
                readPath(shelf, ["endpoint", "browseEndpoint", "browseId"]),
            );
            const listId = stripPlaylistBrowseId(browseId);
            if (!listId || seen.has(listId)) continue;
            const name = pickFirstRun(shelf["title"]);
            if (!name) continue;
            seen.add(listId);
            out.push({ listId, name });
        }
    }
    return out;
}

/**
 * Named playlists from the Playlists tab, which holds the full list (the Home
 * tab shows a curated subset). Keeps `PL…` IDs only: the private lists (`FL`,
 * `LL`, `WL`, `HL`) have no public feed.
 */
export function parsePlaylistsTab(ytInitialData: unknown): NamedPlaylist[] {
    if (!isRecord(ytInitialData)) return [];
    const tabs = readPath(ytInitialData, ["contents", "twoColumnBrowseResultsRenderer", "tabs"]);
    if (!Array.isArray(tabs)) return [];

    const out: NamedPlaylist[] = [];
    const seen = new Set<string>();
    for (const tab of tabs) {
        const sections = readPath(tab, [
            "tabRenderer",
            "content",
            "sectionListRenderer",
            "contents",
        ]);
        if (!Array.isArray(sections)) continue;
        collectLockupPlaylists(sections, out, seen);
    }
    return out;
}

function collectLockupPlaylists(node: unknown, out: NamedPlaylist[], seen: Set<string>): void {
    if (Array.isArray(node)) {
        for (const item of node) {
            collectLockupPlaylists(item, out, seen);
        }
        return;
    }
    if (!isRecord(node)) return;

    const lockup = node["lockupViewModel"];
    if (isRecord(lockup)) {
        const contentType = pickString(lockup["contentType"]);
        if (contentType === "LOCKUP_CONTENT_TYPE_PLAYLIST") {
            const contentId = pickString(lockup["contentId"]);
            if (contentId && contentId.startsWith("PL") && !seen.has(contentId)) {
                const name = pickString(
                    readPath(lockup, ["metadata", "lockupMetadataViewModel", "title", "content"]),
                );
                if (name) {
                    seen.add(contentId);
                    out.push({ listId: asListId(contentId), name });
                }
            }
        }
    }

    // Older "grid" shape – kept as a fallback for layout drift.
    const grid = node["gridPlaylistRenderer"];
    if (isRecord(grid)) {
        const contentId = pickString(grid["playlistId"]);
        if (contentId && contentId.startsWith("PL") && !seen.has(contentId)) {
            const name = pickFirstRun(grid["title"]);
            if (name) {
                seen.add(contentId);
                out.push({ listId: asListId(contentId), name });
            }
        }
    }

    for (const value of Object.values(node)) {
        collectLockupPlaylists(value, out, seen);
    }
}

function parseFromDom(doc: Document): ChannelInfo | null {
    const channelId = extractDomChannel(doc);
    const channelTitle = extractDomTitle(doc);
    if (!channelId || !channelTitle) return null;
    return { channelId, channelTitle, playlists: [] };
}

/**
 * Resolves at `readyState === "complete"` or after `timeoutMs`. YouTube emits
 * the inline ytInitialData script late in the body, so an early read can miss
 * it; after the timeout, `resolveChannelInfo`'s refetch can still recover.
 */
export function whenDocumentReady(doc: Document, timeoutMs = 2000): Promise<void> {
    if (doc.readyState === "complete") return Promise.resolve();
    return new Promise<void>((resolve) => {
        const cleanup = (): void => {
            clearTimeout(timer);
            doc.removeEventListener("readystatechange", onChange);
        };
        const onChange = (): void => {
            if (doc.readyState === "complete") {
                cleanup();
                resolve();
            }
        };
        const timer = setTimeout(() => {
            cleanup();
            resolve();
        }, timeoutMs);
        doc.addEventListener("readystatechange", onChange);
    });
}

export interface ResolveChannelInfoDeps {
    /** Snapshot of `ytInitialData` from the live page (window/wrappedJSObject/inline-script). */
    initialYtInitialData: unknown;
    /** Live document used for DOM-microdata fallback. */
    document: Document;
    /** Returns the HTML body of the current URL, or `null` if the fetch failed. */
    fetchCurrentPage: () => Promise<string | null>;
}

/**
 * Refetches the current URL when the live document yields nothing: YouTube's
 * SPA navigation doesn't refresh the inline ytInitialData.
 */
export async function resolveChannelInfo(
    deps: ResolveChannelInfoDeps,
): Promise<ChannelInfo | null> {
    const local = parseChannelInfo({
        ytInitialData: deps.initialYtInitialData,
        document: deps.document,
    });
    if (local) return local;

    let html: string | null = null;
    try {
        html = await deps.fetchCurrentPage();
    } catch {
        return null;
    }
    if (html === null) return null;

    const freshDoc = new DOMParser().parseFromString(html, "text/html");
    const freshYtInitialData = extractYtInitialData(freshDoc);
    const fromFetched = parseChannelInfo({ ytInitialData: freshYtInitialData, document: freshDoc });
    if (fromFetched) return fromFetched;

    // An SPA navigation can finish during the fetch, so the live DOM gets a
    // second read; the fetched page still wins when it yields data.
    return parseChannelInfo({ document: deps.document });
}

export function extractYtInitialData(doc: Document): unknown {
    const MARKER = "var ytInitialData = ";
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
        const text = script.textContent;
        if (!text) continue;
        const start = text.indexOf(MARKER);
        if (start === -1) continue;
        const open = text.indexOf("{", start);
        if (open === -1) continue;
        const slice = sliceJsonObject(text, open);
        if (slice === null) continue;
        try {
            return JSON.parse(slice);
        } catch {
            // Try the next script tag.
        }
    }
    return null;
}

function sliceJsonObject(text: string, openIndex: number): string | null {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = openIndex; i < text.length; i++) {
        const c = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === "\\") {
            escape = true;
            continue;
        }
        if (c === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) return text.slice(openIndex, i + 1);
        }
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/** YouTube rich text is either `{ simpleText }` or `{ runs: [{ text }] }`. */
function pickFirstRun(value: unknown): string | null {
    if (!isRecord(value)) return null;
    const simple = pickString(value["simpleText"]);
    if (simple) return simple;
    const runs = value["runs"];
    if (Array.isArray(runs)) {
        for (const run of runs) {
            if (isRecord(run)) {
                const text = pickString(run["text"]);
                if (text) return text;
            }
        }
    }
    return null;
}

function readPath(root: unknown, path: ReadonlyArray<string | number>): unknown {
    let cursor: unknown = root;
    for (const key of path) {
        if (typeof key === "number") {
            if (!Array.isArray(cursor)) return undefined;
            cursor = cursor[key];
        } else {
            if (!isRecord(cursor)) return undefined;
            cursor = cursor[key];
        }
        if (cursor === undefined) return undefined;
    }
    return cursor;
}

/** `VLPL…` → `PL…`; drops `UU…` system lists, which the fixed rows cover. */
function stripPlaylistBrowseId(browseId: string | null): ListId | null {
    if (!browseId) return null;
    if (!browseId.startsWith("VL")) return null;
    const listId = browseId.slice(2);
    if (listId.startsWith("UU")) return null;
    return listId.length > 0 ? asListId(listId) : null;
}
