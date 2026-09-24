import "@/ui/popup.css";

import { buildFeeds, type ChannelInfo, type NamedPlaylist } from "@/lib/feed-builder";
import { isChannelId } from "@/lib/youtube-ids";
import { renderFeedList } from "@/ui/feed-list";

export interface InitOptions {
    info: ChannelInfo;
    copy: (text: string) => Promise<void>;
}

export function init(container: HTMLElement, options: InitOptions): void {
    const rows = buildFeeds(options.info);
    renderFeedList(container, rows, { copy: options.copy });
}

export interface BootOptions {
    fetchChannelInfo: () => Promise<ChannelInfo | null>;
    copy: (text: string) => Promise<void>;
}

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

const ISSUES_URL = "https://github.com/florinungur/rsstreams/issues";
const REPORT_EMAIL = "florin@florinungur.com";

type SafeHref = `https://${string}` | `mailto:${string}`;

function makeLink(href: SafeHref, text: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.className = "feed-list__empty-link";
    a.href = href;
    a.textContent = text;
    if (href.startsWith("https://")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
    }
    return a;
}

function renderEmpty(container: HTMLElement): void {
    container.replaceChildren();
    const p = document.createElement("p");
    p.className = "feed-list__empty";
    p.append(
        "Couldn't read this page. Open a YouTube channel, video, or playlist and try again. ",
        "If you're already on YouTube, please report it at ",
    );
    p.appendChild(makeLink(ISSUES_URL, ISSUES_URL));
    p.append(" or email ");
    p.appendChild(makeLink(`mailto:${REPORT_EMAIL}`, REPORT_EMAIL));
    p.append(".");
    container.appendChild(p);
}

// Lets the E2E suite target a tab: a popup opened by URL is itself the active tab.
function tabIdOverride(): number | undefined {
    const raw = new URLSearchParams(location.search).get("tabId");
    if (raw === null) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

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
    if (typeof v["channelId"] !== "string" || !isChannelId(v["channelId"])) return false;
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
