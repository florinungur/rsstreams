import type { FeedRow } from "../lib/feed-builder";

export interface FeedListOptions {
    /** Called when the user clicks "Copy" on a row. Receives the feed URL. */
    copy: (text: string) => Promise<void>;
    /** Milliseconds to show the "Copied" / "Copy failed" flash before resetting. */
    flashMs?: number;
}

const DEFAULT_FLASH_MS = 1500;
const COPY_LABEL = "Copy";
const COPIED_LABEL = "Copied";
const FAILED_LABEL = "Copy failed";
const SUCCESS_CLASS = "feed-row__copy--success";
const ERROR_CLASS = "feed-row__copy--error";

export interface ChannelFeeds {
    title: string;
    rows: FeedRow[];
}

/**
 * Renders each channel's system rows, then its playlists in a collapsed
 * `<details>`. Channels get a titled section only when there are several.
 */
export function renderFeedList(
    container: HTMLElement,
    channels: ChannelFeeds[],
    options: FeedListOptions,
): void {
    container.replaceChildren();
    for (const channel of channels) {
        let parent: HTMLElement = container;
        if (channels.length > 1) {
            parent = document.createElement("section");
            parent.className = "feed-list__channel";
            const title = document.createElement("h2");
            title.className = "feed-list__channel-title";
            title.textContent = channel.title;
            parent.appendChild(title);
            container.appendChild(parent);
        }
        appendRows(parent, channel.rows, options);
    }
}

function appendRows(parent: HTMLElement, rows: FeedRow[], options: FeedListOptions): void {
    const systemRows: FeedRow[] = [];
    const playlistRows: FeedRow[] = [];
    for (const row of rows) {
        if (row.variant === "playlist") {
            playlistRows.push(row);
        } else {
            systemRows.push(row);
        }
    }

    if (systemRows.length > 0) {
        parent.appendChild(buildGroup(systemRows, options));
    }
    if (playlistRows.length > 0) {
        // Collapsed by default: a channel can have dozens of playlists.
        const details = document.createElement("details");
        details.className = "feed-list__playlists";

        const summary = document.createElement("summary");
        summary.className = "feed-list__heading";
        summary.textContent = `Playlists (${playlistRows.length})`;
        details.appendChild(summary);

        details.appendChild(buildGroup(playlistRows, options));
        parent.appendChild(details);
    }
}

function buildGroup(rows: FeedRow[], options: FeedListOptions): HTMLUListElement {
    const ul = document.createElement("ul");
    ul.className = "feed-list__group";
    for (const row of rows) {
        ul.appendChild(buildRow(row, options));
    }
    return ul;
}

function buildRow(row: FeedRow, options: FeedListOptions): HTMLLIElement {
    const li = document.createElement("li");
    li.className = `feed-row feed-row--${row.variant}`;

    const label = document.createElement("span");
    label.className = "feed-row__label";
    label.textContent = row.label;

    const url = document.createElement("code");
    url.className = "feed-row__url";
    url.textContent = row.url.toString();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "feed-row__copy";
    button.textContent = COPY_LABEL;
    button.addEventListener("click", () => {
        void runCopy(button, row.url.toString(), options);
    });

    li.append(label, url, button);
    return li;
}

async function runCopy(
    button: HTMLButtonElement,
    text: string,
    options: FeedListOptions,
): Promise<void> {
    const flashMs = options.flashMs ?? DEFAULT_FLASH_MS;
    button.disabled = true;
    try {
        await options.copy(text);
        button.textContent = COPIED_LABEL;
        button.classList.add(SUCCESS_CLASS);
    } catch {
        button.textContent = FAILED_LABEL;
        button.classList.add(ERROR_CLASS);
    }
    setTimeout(() => {
        button.textContent = COPY_LABEL;
        button.classList.remove(SUCCESS_CLASS, ERROR_CLASS);
        button.disabled = false;
    }, flashMs);
}
