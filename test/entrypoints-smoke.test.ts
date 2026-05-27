// Smoke tests that exercise the entrypoint shells (`background.ts` and
// `extract-channel.ts`) so the v8 coverage provider records 100% on them.
// Both files are thin wrappers over WXT auto-globals registered in
// `test/setup.ts`; this module imports + invokes them once.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("entrypoint shells", () => {
    it("background.ts is a no-op spec function", async () => {
        const mod = await import("@/entrypoints/background");
        const spec = mod.default as unknown as () => void;
        expect(typeof spec).toBe("function");
        expect(spec()).toBeUndefined();
    });

    describe("extract-channel.ts", () => {
        beforeEach(() => {
            // Stub fetch with a 404 by default; individual tests override.
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }),
            );
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("returns null when ytInitialData and microdata are absent", async () => {
            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<unknown>;
            expect(typeof spec).toBe("function");
            // jsdom's default document has no microdata; ytInitialData is
            // undefined on window. parseChannelInfo returns null without ever
            // calling fetch.
            expect(await spec()).toBeNull();
        });

        it("falls back to inline window.ytInitialData and skips the playlists fetch when it fails", async () => {
            // Stub the page's ytInitialData with channel metadata + a Home
            // shelf playlist.
            vi.stubGlobal("ytInitialData", undefined);
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCSMOKEXXXXXXXXXXXXXXXXX",
                        title: "Smoke Channel",
                    },
                },
                contents: {
                    twoColumnBrowseResultsRenderer: {
                        tabs: [
                            {
                                tabRenderer: {
                                    content: {
                                        sectionListRenderer: {
                                            contents: [
                                                {
                                                    itemSectionRenderer: {
                                                        contents: [
                                                            {
                                                                shelfRenderer: {
                                                                    title: {
                                                                        runs: [
                                                                            { text: "Home Shelf" },
                                                                        ],
                                                                    },
                                                                    endpoint: {
                                                                        browseEndpoint: {
                                                                            browseId:
                                                                                "VLPLSMOKE0001",
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            };
            // fetch stub returns !ok so the catch fires and we fall back to
            // the Home-shelf playlist.
            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<{
                channelId: string;
                playlists: Array<{ listId: string; name: string }>;
            } | null>;
            const result = await spec();
            expect(result?.channelId).toBe("UCSMOKEXXXXXXXXXXXXXXXXX");
            expect(result?.playlists).toEqual([{ listId: "PLSMOKE0001", name: "Home Shelf" }]);
            delete (window as unknown as { ytInitialData?: unknown }).ytInitialData;
        });

        it("replaces Home-shelf playlists with the canonical Playlists-tab list when fetch succeeds", async () => {
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCSMOKEXXXXXXXXXXXXXXXXX",
                        title: "Smoke Channel",
                    },
                },
            };
            const playlistsHtml = `<html><body><script>var ytInitialData = ${JSON.stringify({
                contents: {
                    twoColumnBrowseResultsRenderer: {
                        tabs: [
                            {
                                tabRenderer: {
                                    selected: true,
                                    content: {
                                        sectionListRenderer: {
                                            contents: [
                                                {
                                                    itemSectionRenderer: {
                                                        contents: [
                                                            {
                                                                lockupViewModel: {
                                                                    contentType:
                                                                        "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                                    contentId: "PLFROMFETCH1",
                                                                    metadata: {
                                                                        lockupMetadataViewModel: {
                                                                            title: {
                                                                                content:
                                                                                    "Fetched Playlist",
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            })};</script></body></html>`;
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({
                    ok: true,
                    text: () => Promise.resolve(playlistsHtml),
                }),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<{
                playlists: Array<{ listId: string; name: string }>;
            } | null>;
            const result = await spec();
            expect(result?.playlists).toEqual([
                { listId: "PLFROMFETCH1", name: "Fetched Playlist" },
            ]);
            delete (window as unknown as { ytInitialData?: unknown }).ytInitialData;
        });

        it("keeps current-page playlists when the playlists tab fetch returns empty", async () => {
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCSMOKEXXXXXXXXXXXXXXXXX",
                        title: "Smoke Channel",
                    },
                },
                contents: {
                    twoColumnBrowseResultsRenderer: {
                        tabs: [
                            {
                                tabRenderer: {
                                    content: {
                                        sectionListRenderer: {
                                            contents: [
                                                {
                                                    itemSectionRenderer: {
                                                        contents: [
                                                            {
                                                                shelfRenderer: {
                                                                    title: {
                                                                        runs: [
                                                                            { text: "Home Shelf" },
                                                                        ],
                                                                    },
                                                                    endpoint: {
                                                                        browseEndpoint: {
                                                                            browseId:
                                                                                "VLPLKEEP00001",
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            };
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({
                    ok: true,
                    text: () =>
                        Promise.resolve(
                            "<html><body><script>var ytInitialData = {};</script></body></html>",
                        ),
                }),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<{
                playlists: Array<{ listId: string; name: string }>;
            } | null>;
            const result = await spec();
            expect(result?.playlists).toEqual([{ listId: "PLKEEP00001", name: "Home Shelf" }]);
            delete (window as unknown as { ytInitialData?: unknown }).ytInitialData;
        });

        it("falls back to current-page playlists when fetch throws", async () => {
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCTHROWXXXXXXXXXXXXXXXXX",
                        title: "Throw Channel",
                    },
                },
            };
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<{
                channelId: string;
                playlists: Array<{ listId: string; name: string }>;
            } | null>;
            const result = await spec();
            expect(result?.channelId).toBe("UCTHROWXXXXXXXXXXXXXXXXX");
            expect(result?.playlists).toEqual([]);
            delete (window as unknown as { ytInitialData?: unknown }).ytInitialData;
        });
    });
});
