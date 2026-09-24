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

/** Renders the system rows, then the playlists in a collapsed `<details>`. */
export function renderFeedList(
    container: HTMLElement,
    rows: FeedRow[],
    options: FeedListOptions,
): void {
    container.replaceChildren();

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
        container.appendChild(buildGroup(systemRows, options));
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
        container.appendChild(details);
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
