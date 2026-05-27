// Pure parser: { ytInitialData, document } → ChannelInfo | null.
//
// Tries ytInitialData first (more structured, stable across YouTube SPA
// navigation) and falls back to DOM microdata when JSON parse fails or fields
// are missing. The Phase 5 nightly canary re-runs the chain against live HTML
// so layout changes surface before users hit them.

import type { ChannelInfo, NamedPlaylist } from "./feed-builder";
import { extractDomChannel, extractDomTitle } from "./selectors";

export interface ParseChannelInfoInput {
    /** Parsed value of `window.ytInitialData` from the YouTube page. */
    ytInitialData?: unknown;
    /** Live document, used as the DOM-fallback source. */
    document?: Document;
}

/**
 * Parse a YouTube page into the `ChannelInfo` the popup needs to build feed
 * rows. Returns `null` when neither source yields a `UC…` channel ID.
 *
 * Channel + handle pages expose the owner via `metadata.channelMetadataRenderer`;
 * watch + playlist pages bury it inside `videoOwnerRenderer` nodes. Named
 * playlists are scraped from the Home-tab `shelfRenderer` entries (channel /
 * handle URLs only); other page kinds return an empty `playlists` array.
 */
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
    channelId: string;
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
    // The Home tab is index 0 on the channel/handle browse response. We walk
    // its section list and pick up any shelf whose endpoint points at a real
    // playlist (`VLPL…`); shelves without a playlist endpoint (engagement
    // panels, generic "Videos" shelves) are skipped.
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

function parseFromDom(doc: Document): ChannelInfo | null {
    const channelId = extractDomChannel(doc);
    const channelTitle = extractDomTitle(doc);
    if (!channelId || !channelTitle) return null;
    return { channelId, channelTitle, playlists: [] };
}

// ----------------------- helpers -----------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChannelId(value: string): boolean {
    return value.startsWith("UC");
}

function pickString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * `{ simpleText }` and `{ runs: [{ text }] }` are the two shapes YouTube uses
 * for rich text. Most channel titles use simpleText; shelf headings + owner
 * names use runs.
 */
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

/**
 * Channel/playlist browse IDs in ytInitialData are prefixed with `VL` (e.g.
 * `VLPLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y` → `PLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y`).
 * System playlists (UU/UULF/UUSH/UULV) are filtered out – they're already
 * surfaced by the 4 system rows.
 */
function stripPlaylistBrowseId(browseId: string | null): string | null {
    if (!browseId) return null;
    if (!browseId.startsWith("VL")) return null;
    const listId = browseId.slice(2);
    if (listId.startsWith("UU")) return null;
    return listId.length > 0 ? listId : null;
}
