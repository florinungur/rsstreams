import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installBrowserMock, type MockBrowser } from "@/__mocks__/browser";
import type { ChannelInfo } from "@/lib/feed-builder";
import { boot, fetchChannelInfoFromActiveTab, init } from "./main";

const VALID_INFO: ChannelInfo = {
    channelId: "UCBJycsmduvYEL83R_U4JriQ",
    channelTitle: "Marques Brownlee",
    playlists: [{ listId: "PLW0jXmYHvbZNT54SkSdVfgxsmqkQwSqsj", name: "Retro Tech" }],
};

describe("popup init – synchronous render", () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("renders 4 system rows + 1 playlist row for a real ChannelInfo", () => {
        init(container, { info: VALID_INFO, copy: vi.fn().mockResolvedValue(undefined) });

        const rows = container.querySelectorAll(".feed-row");
        expect(rows).toHaveLength(5);
        expect(rows[0]?.classList.contains("feed-row--uploads")).toBe(true);
        expect(rows[4]?.classList.contains("feed-row--playlist")).toBe(true);
    });

    it("passes the injected copy function through to row buttons", async () => {
        const copy = vi.fn().mockResolvedValue(undefined);
        init(container, { info: VALID_INFO, copy });

        const firstButton = container.querySelector<HTMLButtonElement>(".feed-row__copy");
        firstButton?.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(copy).toHaveBeenCalledWith(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        );
    });
});

describe("popup boot – async wiring", () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it("renders feeds when fetchChannelInfo resolves to a ChannelInfo", async () => {
        await boot(container, {
            fetchChannelInfo: () => Promise.resolve(VALID_INFO),
            copy: vi.fn(),
        });

        expect(container.querySelectorAll(".feed-row")).toHaveLength(5);
    });

    it("renders the empty-state message when fetchChannelInfo resolves to null", async () => {
        await boot(container, {
            fetchChannelInfo: () => Promise.resolve(null),
            copy: vi.fn(),
        });

        const empty = container.querySelector(".feed-list__empty");
        expect(empty).not.toBeNull();
        expect(empty?.textContent).toContain("Couldn't read this page");
    });

    it("renders the empty-state message when fetchChannelInfo rejects", async () => {
        await boot(container, {
            fetchChannelInfo: () => Promise.reject(new Error("scripting failed")),
            copy: vi.fn(),
        });

        expect(container.querySelector(".feed-list__empty")).not.toBeNull();
    });
});

describe("fetchChannelInfoFromActiveTab", () => {
    let mockBrowser: MockBrowser;

    beforeEach(() => {
        mockBrowser = installBrowserMock();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("queries the active tab and injects extract-channel.js", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 42 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: VALID_INFO }]);

        const info = await fetchChannelInfoFromActiveTab();

        expect(info).toEqual(VALID_INFO);
        expect(mockBrowser.tabs.query).toHaveBeenCalledWith({
            active: true,
            currentWindow: true,
        });
        expect(mockBrowser.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 42 },
            files: ["extract-channel.js"],
        });
    });

    it("returns null when the active tab has no id", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{}]);
        const info = await fetchChannelInfoFromActiveTab();
        expect(info).toBeNull();
        expect(mockBrowser.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("returns null when tabs.query returns an empty array", async () => {
        mockBrowser.tabs.query.mockResolvedValue([]);
        const info = await fetchChannelInfoFromActiveTab();
        expect(info).toBeNull();
        expect(mockBrowser.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("returns null when executeScript yields no results", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("returns null when the script result has no channelId", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: null }]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("rejects results whose channelId is not UC-prefixed", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: { channelId: "NOTUC123", channelTitle: "x", playlists: [] },
            },
        ]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("rejects results with a non-string channelTitle", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: { channelId: "UCxxxxxxxxxxxxxxxxxxxxxx", channelTitle: "", playlists: [] },
            },
        ]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("rejects results whose playlists is not an array", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: {
                    channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
                    channelTitle: "Name",
                    playlists: "nope",
                },
            },
        ]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("rejects results whose playlist entries lack listId/name", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: {
                    channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
                    channelTitle: "Name",
                    playlists: [{ listId: "PL1", name: "" }],
                },
            },
        ]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("rejects results whose playlist entries are not objects", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: {
                    channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
                    channelTitle: "Name",
                    playlists: [null],
                },
            },
        ]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });

    it("accepts a result with empty playlists", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([
            {
                frameId: 0,
                result: {
                    channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
                    channelTitle: "Name",
                    playlists: [],
                },
            },
        ]);
        const info = await fetchChannelInfoFromActiveTab();
        expect(info?.channelId).toBe("UCxxxxxxxxxxxxxxxxxxxxxx");
    });

    it("rejects a primitive script result", async () => {
        mockBrowser.tabs.query.mockResolvedValue([{ id: 1 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: "string" }]);
        expect(await fetchChannelInfoFromActiveTab()).toBeNull();
    });
});

describe("fetchChannelInfoFromActiveTab – ?tabId override", () => {
    let mockBrowser: MockBrowser;

    beforeEach(() => {
        mockBrowser = installBrowserMock();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.history.replaceState(null, "", "/");
    });

    it("targets the ?tabId tab directly without querying the active tab", async () => {
        window.history.replaceState(null, "", "/popup.html?tabId=7");
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: VALID_INFO }]);

        const info = await fetchChannelInfoFromActiveTab();

        expect(info).toEqual(VALID_INFO);
        expect(mockBrowser.tabs.query).not.toHaveBeenCalled();
        expect(mockBrowser.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 7 },
            files: ["extract-channel.js"],
        });
    });

    it("ignores a non-numeric tabId and falls back to the active tab", async () => {
        window.history.replaceState(null, "", "/popup.html?tabId=abc");
        mockBrowser.tabs.query.mockResolvedValue([{ id: 99 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: VALID_INFO }]);

        await fetchChannelInfoFromActiveTab();

        expect(mockBrowser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
        expect(mockBrowser.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 99 },
            files: ["extract-channel.js"],
        });
    });

    it("ignores a negative tabId and falls back to the active tab", async () => {
        window.history.replaceState(null, "", "/popup.html?tabId=-3");
        mockBrowser.tabs.query.mockResolvedValue([{ id: 99 }]);
        mockBrowser.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: VALID_INFO }]);

        await fetchChannelInfoFromActiveTab();

        expect(mockBrowser.tabs.query).toHaveBeenCalled();
        expect(mockBrowser.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 99 },
            files: ["extract-channel.js"],
        });
    });
});
