// Pure render module for the popup's feed list. DOM ops on a passed-in
// container; copy + flash timer injected via options for testability.
// The popup entrypoint wires this to `navigator.clipboard.writeText`.

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

/**
 * Render the feed list into `container`, replacing any existing children.
 * Each row shows the label, the feed URL, and a "Copy" button that calls
 * `options.copy` with the URL and flashes "Copied" / "Copy failed" before
 * resetting after `options.flashMs` (default 1500ms).
 */
export function renderFeedList(
    container: HTMLElement,
    rows: FeedRow[],
    options: FeedListOptions,
): void {
    container.replaceChildren();

    const list = document.createElement("ul");
    list.className = "feed-list";

    for (const row of rows) {
        list.appendChild(buildRow(row, options));
    }

    container.appendChild(list);
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
