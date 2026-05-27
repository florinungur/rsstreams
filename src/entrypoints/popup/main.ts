import "@/ui/popup.css";

import { buildFeeds, type ChannelInfo } from "@/lib/feed-builder";
import { renderFeedList } from "@/ui/feed-list";

/**
 * Phase 3 dev fixture – MKBHD's channel with two named playlists. Phase 4
 * replaces this with real `ChannelInfo` returned from
 * `browser.scripting.executeScript({ files: ['extract-channel.js'] })`.
 */
export const DEV_FIXTURE: ChannelInfo = {
    channelId: "UCBJycsmduvYEL83R_U4JriQ",
    channelTitle: "Marques Brownlee",
    playlists: [
        { listId: "PLW0jXmYHvbZNT54SkSdVfgxsmqkQwSqsj", name: "Retro Tech" },
        { listId: "PLW0jXmYHvbZP-w5Z0XdfNqJ0u3vqvb-zg", name: "Studio Tours" },
    ],
};

export interface InitOptions {
    info: ChannelInfo;
    copy: (text: string) => Promise<void>;
}

/**
 * Mount the popup into `container`. Pure wrapper around `buildFeeds` +
 * `renderFeedList` – kept testable by injecting both the `ChannelInfo` and
 * the clipboard write function. The boot block below wires it to
 * `navigator.clipboard.writeText` and is exercised by Selenium E2E in Phase 5.
 */
export function init(container: HTMLElement, options: InitOptions): void {
    const rows = buildFeeds(options.info);
    renderFeedList(container, rows, { copy: options.copy });
}

/* c8 ignore start -- boot path; exercised by Selenium E2E in Phase 5. */
const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
    init(root, {
        info: DEV_FIXTURE,
        copy: (text) => navigator.clipboard.writeText(text),
    });
}
/* c8 ignore stop */
