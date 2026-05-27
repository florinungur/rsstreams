import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedRow } from "../lib/feed-builder";
import { renderFeedList } from "./feed-list";

function uploadsRow(): FeedRow {
    return {
        label: "All uploads",
        url: new URL(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        ),
        variant: "uploads",
    };
}

function shortsRow(): FeedRow {
    return {
        label: "Shorts only",
        url: new URL(
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UUSHBJycsmduvYEL83R_U4JriQ",
        ),
        variant: "shorts",
    };
}

function playlistRow(name = "Retro Tech", listId = "PLretro"): FeedRow {
    return {
        label: name,
        url: new URL(`https://www.youtube.com/feeds/videos.xml?playlist_id=${listId}`),
        variant: "playlist",
        playlistId: listId,
    };
}

// Drain queued microtasks (e.g. the awaited `options.copy(...)` Promise inside
// the click handler) without advancing fake timers.
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe("renderFeedList", () => {
    let container: HTMLElement;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        vi.useRealTimers();
        container.remove();
    });

    it("renders one .feed-row per FeedRow with label, URL, and copy button", () => {
        renderFeedList(container, [uploadsRow(), shortsRow()], {
            copy: vi.fn().mockResolvedValue(undefined),
        });

        const rows = container.querySelectorAll<HTMLLIElement>(".feed-row");
        expect(rows).toHaveLength(2);

        expect(rows[0]?.classList.contains("feed-row--uploads")).toBe(true);
        expect(rows[0]?.querySelector(".feed-row__label")?.textContent).toBe("All uploads");
        expect(rows[0]?.querySelector(".feed-row__url")?.textContent).toBe(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        );
        expect(rows[0]?.querySelector("button.feed-row__copy")?.textContent).toBe("Copy");

        expect(rows[1]?.classList.contains("feed-row--shorts")).toBe(true);
        expect(rows[1]?.querySelector(".feed-row__label")?.textContent).toBe("Shorts only");
    });

    it("replaces any existing content in the container", () => {
        container.innerHTML = "<p data-stale>old</p>";
        renderFeedList(container, [uploadsRow()], {
            copy: vi.fn().mockResolvedValue(undefined),
        });
        expect(container.querySelector("[data-stale]")).toBeNull();
        expect(container.querySelectorAll(".feed-row")).toHaveLength(1);
    });

    it("renders nothing when given zero rows", () => {
        renderFeedList(container, [], { copy: vi.fn().mockResolvedValue(undefined) });
        expect(container.children).toHaveLength(0);
    });

    it("omits the Playlists heading when no playlist rows are present", () => {
        renderFeedList(container, [uploadsRow(), shortsRow()], {
            copy: vi.fn().mockResolvedValue(undefined),
        });
        expect(container.querySelector(".feed-list__heading")).toBeNull();
        expect(container.querySelectorAll(".feed-list__group")).toHaveLength(1);
    });

    it("wraps playlist rows in a collapsed <details> with a counted summary", () => {
        renderFeedList(
            container,
            [
                uploadsRow(),
                shortsRow(),
                playlistRow("Retro Tech", "PLretro"),
                playlistRow("Reviews!", "PLreviews"),
            ],
            { copy: vi.fn().mockResolvedValue(undefined) },
        );

        const groups = container.querySelectorAll<HTMLUListElement>(".feed-list__group");
        expect(groups).toHaveLength(2);
        expect(groups[0]?.querySelectorAll(".feed-row")).toHaveLength(2);
        expect(groups[1]?.querySelectorAll(".feed-row")).toHaveLength(2);

        const details = container.querySelector<HTMLDetailsElement>(".feed-list__playlists");
        expect(details).not.toBeNull();
        // Default closed – playlist channels can have 20+ entries; users want
        // the 4 system feeds visible first.
        expect(details?.open).toBe(false);

        const summary = details?.querySelector("summary.feed-list__heading");
        expect(summary?.tagName).toBe("SUMMARY");
        expect(summary?.textContent).toBe("Playlists (2)");

        // Details should sit after the system-rows group.
        expect(groups[0]?.nextElementSibling).toBe(details);
        // Playlist group sits inside the details element.
        expect(details?.contains(groups[1] as Element)).toBe(true);
    });

    it("renders only a collapsed Playlists <details> when no system rows are present", () => {
        renderFeedList(container, [playlistRow("Solo playlist", "PLsolo")], {
            copy: vi.fn().mockResolvedValue(undefined),
        });
        const groups = container.querySelectorAll(".feed-list__group");
        expect(groups).toHaveLength(1);
        const details = container.querySelector<HTMLDetailsElement>(".feed-list__playlists");
        expect(details).not.toBeNull();
        expect(details?.open).toBe(false);
        expect(details?.querySelector("summary.feed-list__heading")?.textContent).toBe(
            "Playlists (1)",
        );
        expect(groups[0]?.querySelectorAll(".feed-row")).toHaveLength(1);
    });

    it("calls copy with the row URL on click, flashes 'Copied', then resets after flashMs", async () => {
        const copy = vi.fn().mockResolvedValue(undefined);
        renderFeedList(container, [uploadsRow()], { copy, flashMs: 1000 });

        const button = container.querySelector<HTMLButtonElement>(".feed-row__copy");
        expect(button).not.toBeNull();
        button?.click();
        await flushMicrotasks();

        expect(copy).toHaveBeenCalledTimes(1);
        expect(copy).toHaveBeenCalledWith(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        );
        expect(button?.textContent).toBe("Copied");
        expect(button?.disabled).toBe(true);
        expect(button?.classList.contains("feed-row__copy--success")).toBe(true);

        vi.advanceTimersByTime(1000);
        expect(button?.textContent).toBe("Copy");
        expect(button?.disabled).toBe(false);
        expect(button?.classList.contains("feed-row__copy--success")).toBe(false);
    });

    it("flashes 'Copy failed' when copy rejects, then resets", async () => {
        const copy = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
        renderFeedList(container, [uploadsRow()], { copy, flashMs: 500 });

        const button = container.querySelector<HTMLButtonElement>(".feed-row__copy");
        button?.click();
        await flushMicrotasks();

        expect(button?.textContent).toBe("Copy failed");
        expect(button?.classList.contains("feed-row__copy--error")).toBe(true);

        vi.advanceTimersByTime(500);
        expect(button?.textContent).toBe("Copy");
        expect(button?.classList.contains("feed-row__copy--error")).toBe(false);
    });

    it("falls back to a 1500ms flash when flashMs is omitted", async () => {
        const copy = vi.fn().mockResolvedValue(undefined);
        renderFeedList(container, [uploadsRow()], { copy });

        const button = container.querySelector<HTMLButtonElement>(".feed-row__copy");
        button?.click();
        await flushMicrotasks();
        expect(button?.textContent).toBe("Copied");

        vi.advanceTimersByTime(1499);
        expect(button?.textContent).toBe("Copied");
        vi.advanceTimersByTime(1);
        expect(button?.textContent).toBe("Copy");
    });
});
