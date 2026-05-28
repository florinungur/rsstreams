import "@/ui/popup.css";

import { buildFeeds, type ChannelInfo, type NamedPlaylist } from "@/lib/feed-builder";
import { renderFeedList } from "@/ui/feed-list";

export interface InitOptions {
    info: ChannelInfo;
    copy: (text: string) => Promise<void>;
}

/**
 * Render the popup's feed rows for a known `ChannelInfo`. Used after
 * `fetchChannelInfo` resolves; kept as a pure synchronous function so unit
 * tests don't have to await the fetch.
 */
export function init(container: HTMLElement, options: InitOptions): void {
    const rows = buildFeeds(options.info);
    renderFeedList(container, rows, { copy: options.copy });
}

export interface BootOptions {
    fetchChannelInfo: () => Promise<ChannelInfo | null>;
    copy: (text: string) => Promise<void>;
}

/**
 * Mount the popup. Calls `fetchChannelInfo` (which in the production boot path
 * is `browser.scripting.executeScript({ files: ['extract-channel.js'] })`),
 * then renders either feed rows or an empty-state message when the current
 * page isn't a YouTube channel/handle/watch/playlist URL.
 */
export async function boot(container: HTMLElement, options: BootOptions): Promise<void> {
    let info: ChannelInfo | null = null;
    try {
        info = await options.fetchChannelInfo();
    } catch {
        info = null;
    }
    if (info) {
        init(container, { info, copy: options.copy });
    } else {
        renderEmpty(container);
    }
}

const EMPTY_MESSAGE =
    "Couldn't read this page. Open a YouTube channel, video, or playlist and try again. " +
    "If you're already on YouTube, please report it at " +
    "https://github.com/florinungur/rsstreams/issues.";

function renderEmpty(container: HTMLElement): void {
    container.replaceChildren();
    const p = document.createElement("p");
    p.className = "feed-list__empty";
    p.textContent = EMPTY_MESSAGE;
    container.appendChild(p);
}

/**
 * Read a `?tabId=N` override from the popup URL. Returns the parsed tab id, or
 * `undefined` when the param is absent or malformed. The override lets the
 * Selenium E2E suite (and manual debugging) point the popup at a specific tab,
 * since a popup opened as a `moz-extension://…/popup.html` page can't rely on
 * `tabs.query({ active: true })` resolving to the underlying YouTube tab.
 */
function tabIdOverride(): number | undefined {
    const raw = new URLSearchParams(location.search).get("tabId");
    if (raw === null) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Inject `extract-channel.js` into the target YouTube tab and return the
 * parsed `ChannelInfo`, or `null` when the page isn't a recognised YouTube
 * URL / the script fails to inject. Targets the `?tabId=` override when
 * present, else the active tab in the current window.
 */
export async function fetchChannelInfoFromActiveTab(): Promise<ChannelInfo | null> {
    const override = tabIdOverride();
    let tabId = override;
    if (override === undefined) {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
    }
    if (tabId === undefined) return null;

    const results = await browser.scripting.executeScript({
        target: { tabId },
        files: ["extract-channel.js"],
    });

    const value = results[0]?.result;
    return isChannelInfo(value) ? value : null;
}

function isChannelInfo(value: unknown): value is ChannelInfo {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    if (typeof v["channelId"] !== "string" || !v["channelId"].startsWith("UC")) return false;
    if (typeof v["channelTitle"] !== "string" || v["channelTitle"].length === 0) return false;
    if (!Array.isArray(v["playlists"])) return false;
    return v["playlists"].every(isNamedPlaylist);
}

function isNamedPlaylist(value: unknown): value is NamedPlaylist {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v["listId"] === "string" &&
        v["listId"].length > 0 &&
        typeof v["name"] === "string" &&
        v["name"].length > 0
    );
}

/* c8 ignore start -- boot path; exercised by the Selenium E2E suite. */
const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
    void boot(root, {
        fetchChannelInfo: fetchChannelInfoFromActiveTab,
        copy: (text) => navigator.clipboard.writeText(text),
    });
}
/* c8 ignore stop */
