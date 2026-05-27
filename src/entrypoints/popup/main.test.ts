import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEV_FIXTURE, init } from "./main";

describe("popup init", () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("renders 4 system rows + 2 playlist rows for the MKBHD dev fixture", () => {
        init(container, {
            info: DEV_FIXTURE,
            copy: vi.fn().mockResolvedValue(undefined),
        });

        const rows = container.querySelectorAll(".feed-row");
        expect(rows).toHaveLength(6);
        expect(rows[0]?.classList.contains("feed-row--uploads")).toBe(true);
        expect(rows[1]?.classList.contains("feed-row--long-form")).toBe(true);
        expect(rows[2]?.classList.contains("feed-row--shorts")).toBe(true);
        expect(rows[3]?.classList.contains("feed-row--live")).toBe(true);
        expect(rows[4]?.classList.contains("feed-row--playlist")).toBe(true);
        expect(rows[5]?.classList.contains("feed-row--playlist")).toBe(true);
    });

    it("passes the injected copy function through to row buttons", async () => {
        const copy = vi.fn().mockResolvedValue(undefined);
        init(container, { info: DEV_FIXTURE, copy });

        const firstButton = container.querySelector<HTMLButtonElement>(".feed-row__copy");
        firstButton?.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(copy).toHaveBeenCalledWith(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        );
    });

    it("exposes a MKBHD ChannelInfo fixture with two named playlists", () => {
        expect(DEV_FIXTURE.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(DEV_FIXTURE.channelTitle).toBe("Marques Brownlee");
        expect(DEV_FIXTURE.playlists).toHaveLength(2);
    });
});
