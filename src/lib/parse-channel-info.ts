import type { ChannelInfo, NamedPlaylist } from "./feed-builder";
import { extractDomChannel, extractDomTitle } from "./selectors";
import { asListId, type ChannelId, isChannelId, type ListId } from "./youtube-ids";

export interface ParseChannelInfoInput {
    /** Parsed value of `window.ytInitialData` from the YouTube page. */
    ytInitialData?: unknown;
    /** Live document, used as the DOM-fallback source. */
    document?: Document;
}

/** Every channel the page belongs to: one, or each collaborator on a collab video. */
export function parseChannelInfo(input: ParseChannelInfoInput): ChannelInfo[] {
    const fromJson = parseFromYtInitialData(input.ytInitialData);
    if (fromJson.length > 0) return fromJson;

    if (input.document) {
        const fromDom = parseFromDom(input.document);
        if (fromDom) return [fromDom];
    }

    return [];
}

function parseFromYtInitialData(ytInitialData: unknown): ChannelInfo[] {
    if (!isRecord(ytInitialData)) return [];

    const playlists = findNamedPlaylists(ytInitialData);
    return findChannelOwners(ytInitialData).map((owner) => ({ ...owner, playlists }));
}

interface OwnerHit {
    channelId: ChannelId;
    channelTitle: string;
}

function findChannelOwners(data: Record<string, unknown>): OwnerHit[] {
    // Channel / handle / browse pages keep the owner in metadata.
    const metadata = readPath(data, ["metadata", "channelMetadataRenderer"]);
    if (isRecord(metadata)) {
        const channelId = pickString(metadata["externalId"]);
        const channelTitle = pickString(metadata["title"]);
        if (channelId && channelTitle && isChannelId(channelId)) {
            return [{ channelId, channelTitle }];
        }
    }

    // Watch + playlist pages bury the owner in a deep `videoOwnerRenderer`.
    return findVideoOwners(data);
}

function findVideoOwners(node: unknown): OwnerHit[] {
    if (isRecord(node)) {
        const renderer = node["videoOwnerRenderer"];
        if (isRecord(renderer)) {
            const owners = readVideoOwners(renderer);
            if (owners.length > 0) return owners;
        }
        for (const value of Object.values(node)) {
            const hits = findVideoOwners(value);
            if (hits.length > 0) return hits;
        }
    } else if (Array.isArray(node)) {
        for (const value of node) {
            const hits = findVideoOwners(value);
            if (hits.length > 0) return hits;
        }
    }
    return [];
}

/**
 * A single owner links straight to its channel. A collab video links a
 * "Collaborators" dialog instead, listing every channel with the uploader first.
 */
function readVideoOwners(renderer: Record<string, unknown>): OwnerHit[] {
    const channelId = pickString(
        readPath(renderer, ["navigationEndpoint", "browseEndpoint", "browseId"]),
    );
    const channelTitle = pickFirstRun(renderer["title"]);
    if (channelId && channelTitle && isChannelId(channelId)) {
        return [{ channelId, channelTitle }];
    }

    const items = readPath(renderer, [
        "navigationEndpoint",
        "showDialogCommand",
        "panelLoadingStrategy",
        "inlineContent",
        "dialogViewModel",
        "customContent",
        "listViewModel",
        "listItems",
    ]);
    if (!Array.isArray(items)) return [];

    const owners: OwnerHit[] = [];
    for (const item of items) {
        const title = readPath(item, ["listItemViewModel", "title"]);
        const collaboratorId = pickString(
            readPath(title, [
                "commandRuns",
                0,
                "onTap",
                "innertubeCommand",
                "browseEndpoint",
                "browseId",
            ]),
        );
        const collaboratorTitle = pickString(readPath(title, ["content"]));
        if (collaboratorId && collaboratorTitle && isChannelId(collaboratorId)) {
            owners.push({ channelId: collaboratorId, channelTitle: collaboratorTitle });
        }
    }
    return owners;
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
        // A Show is a playlist under another lockup type.
        if (
            contentType === "LOCKUP_CONTENT_TYPE_PLAYLIST" ||
            contentType === "LOCKUP_CONTENT_TYPE_SHOW"
        ) {
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
    /**
     * True when the page changed after the document loaded. YouTube's SPA
     * navigation keeps the first-loaded page's ytInitialData and microdata,
     * so the live sources would describe that page instead.
     */
    navigatedSinceLoad: boolean;
    /** Snapshot of `ytInitialData` from the live page (window/wrappedJSObject/inline-script). */
    initialYtInitialData: unknown;
    /** Live document used for DOM-microdata fallback. */
    document: Document;
    /** Returns the HTML body of the current URL, or `null` if the fetch failed. */
    fetchCurrentPage: () => Promise<string | null>;
}

/** Reads the live page unless it's stale, then refetches the current URL. */
export async function resolveChannelInfo(deps: ResolveChannelInfoDeps): Promise<ChannelInfo[]> {
    if (!deps.navigatedSinceLoad) {
        const local = parseChannelInfo({
            ytInitialData: deps.initialYtInitialData,
            document: deps.document,
        });
        if (local.length > 0) return local;
    }

    let html: string | null = null;
    try {
        html = await deps.fetchCurrentPage();
    } catch {
        return [];
    }
    if (html === null) return [];

    const freshDoc = new DOMParser().parseFromString(html, "text/html");
    const freshYtInitialData = extractYtInitialData(freshDoc);
    const fromFetched = parseChannelInfo({ ytInitialData: freshYtInitialData, document: freshDoc });
    if (fromFetched.length > 0 || deps.navigatedSinceLoad) return fromFetched;

    // A document still loading at the first read can finish during the
    // fetch, so the live DOM gets a second read.
    return parseChannelInfo({ document: deps.document });
}

/**
 * YouTube serves ytInitialData either as a `<script id="yt-initial-data"
 * type="application/json">` element or inline as `var ytInitialData = {…}`.
 */
export function extractYtInitialData(doc: Document): unknown {
    const json = doc.getElementById("yt-initial-data")?.textContent;
    if (json) {
        try {
            return JSON.parse(json);
        } catch {
            // Fall through to the inline form.
        }
    }

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
