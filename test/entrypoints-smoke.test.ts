import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("entrypoint shells", () => {
    it("background.ts is a no-op spec function", async () => {
        const mod = await import("@/entrypoints/background");
        const spec = mod.default as unknown as () => void;
        expect(typeof spec).toBe("function");
        expect(spec()).toBeUndefined();
    });

    describe("extract-channel.ts", () => {
        // jsdom records no navigation entry; stand in for a document loaded at `url`.
        const loadedAt = (url: string | null): void => {
            vi.spyOn(performance, "getEntriesByType").mockReturnValue(
                url === null ? [] : [{ name: url } as PerformanceEntry],
            );
        };

        beforeEach(() => {
            // Stub fetch with a 404 by default; individual tests override.
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") }),
            );
            loadedAt(location.href);
        });

        afterEach(() => {
            delete (window as unknown as { ytInitialData?: unknown }).ytInitialData;
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        });

        it("returns no channels when ytInitialData and microdata are absent", async () => {
            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<unknown>;
            expect(typeof spec).toBe("function");
            expect(await spec()).toEqual([]);
        });

        it("falls back to inline window.ytInitialData and skips the playlists fetch when it fails", async () => {
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
            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    channelId: string;
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCSMOKEXXXXXXXXXXXXXXXXX");
            expect(result?.playlists).toEqual([{ listId: "PLSMOKE0001", name: "Home Shelf" }]);
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
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.playlists).toEqual([
                { listId: "PLFROMFETCH1", name: "Fetched Playlist" },
            ]);
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
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.playlists).toEqual([{ listId: "PLKEEP00001", name: "Home Shelf" }]);
        });

        it("recovers via same-origin fetch when the live page has no ytInitialData", async () => {
            const channelHtml = `<html><body><script>var ytInitialData = ${JSON.stringify({
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCRECOVERXXXXXXXXXXXXXX",
                        title: "Recovered Channel",
                    },
                },
            })};</script></body></html>`;
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({
                    ok: true,
                    text: () => Promise.resolve(channelHtml),
                }),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    channelId: string;
                    channelTitle: string;
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCRECOVERXXXXXXXXXXXXXX");
            expect(result?.channelTitle).toBe("Recovered Channel");
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
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    channelId: string;
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCTHROWXXXXXXXXXXXXXXXXX");
            expect(result?.playlists).toEqual([]);
        });

        it("falls back to current-page playlists when the playlists tab fetch times out", async () => {
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCHANGXXXXXXXXXXXXXXXXXX",
                        title: "Hang Channel",
                    },
                },
            };
            // The fetch settles only through its abort signal, which here has already fired.
            vi.spyOn(AbortSignal, "timeout").mockReturnValue(
                AbortSignal.abort(new DOMException("timed out", "TimeoutError")),
            );
            vi.stubGlobal(
                "fetch",
                vi.fn(
                    (_url: string, init?: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            if (init?.signal?.aborted) reject(init.signal.reason);
                        }),
                ),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<
                Array<{
                    channelId: string;
                    playlists: Array<{ listId: string; name: string }>;
                }>
            >;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCHANGXXXXXXXXXXXXXXXXXX");
            expect(result?.playlists).toEqual([]);
        });

        it("reads the open page when only its query string was rewritten", async () => {
            const rewritten = new URL(location.href);
            rewritten.searchParams.set("themeRefresh", "1");
            loadedAt(rewritten.href);
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCOPENPAGEXXXXXXXXXXXXXX",
                        title: "Open Page Channel",
                    },
                },
            };

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<Array<{ channelId: string }>>;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCOPENPAGEXXXXXXXXXXXXXX");
        });

        it.each([
            ["the document loaded at another URL", "https://www.youtube.com/@previous"],
            [
                "the document loaded at another video",
                `${location.origin}${location.pathname}?v=previous`,
            ],
            [
                "the document loaded at another playlist",
                `${location.origin}${location.pathname}?list=PLprevious`,
            ],
            ["the navigation entry is missing", null],
        ])("refetches over a stale window.ytInitialData when %s", async (_case, loadedUrl) => {
            loadedAt(loadedUrl);
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCPREVIOUSXXXXXXXXXXXXX",
                        title: "Previous Channel",
                    },
                },
            };
            const currentHtml = `<html><body><script>var ytInitialData = ${JSON.stringify({
                metadata: {
                    channelMetadataRenderer: {
                        externalId: "UCCURRENTXXXXXXXXXXXXXX",
                        title: "Current Channel",
                    },
                },
            })};</script></body></html>`;
            vi.stubGlobal(
                "fetch",
                vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(currentHtml) }),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<Array<{ channelId: string }>>;
            const [result] = await spec();
            expect(result?.channelId).toBe("UCCURRENTXXXXXXXXXXXXXX");
        });

        it("returns every collaborator on a collab video, each with its own Playlists tab", async () => {
            const collaborator = (browseId: string, content: string): unknown => ({
                listItemViewModel: {
                    title: {
                        content,
                        commandRuns: [
                            { onTap: { innertubeCommand: { browseEndpoint: { browseId } } } },
                        ],
                    },
                },
            });
            (window as unknown as { ytInitialData?: unknown }).ytInitialData = {
                videoOwnerRenderer: {
                    navigationEndpoint: {
                        showDialogCommand: {
                            panelLoadingStrategy: {
                                inlineContent: {
                                    dialogViewModel: {
                                        customContent: {
                                            listViewModel: {
                                                listItems: [
                                                    collaborator(
                                                        "UCUPLOADERXXXXXXXXXXXXX",
                                                        "Uploader",
                                                    ),
                                                    collaborator(
                                                        "UCGUESTXXXXXXXXXXXXXXXX",
                                                        "Guest",
                                                    ),
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };
            // Each channel's Playlists tab lists one playlist named after the channel id.
            const playlistsTab = (channelId: string): string =>
                `<html><body><script>var ytInitialData = ${JSON.stringify({
                    contents: {
                        twoColumnBrowseResultsRenderer: {
                            tabs: [
                                {
                                    tabRenderer: {
                                        content: {
                                            sectionListRenderer: {
                                                contents: [
                                                    {
                                                        gridPlaylistRenderer: {
                                                            playlistId: `PL${channelId}`,
                                                            title: { simpleText: channelId },
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
                vi.fn().mockImplementation(async (url: string) => {
                    const channelId = /^\/channel\/(UC\w+)\/playlists$/.exec(url)?.[1];
                    return channelId
                        ? { ok: true, text: () => Promise.resolve(playlistsTab(channelId)) }
                        : { ok: false, text: () => Promise.resolve("") };
                }),
            );

            const mod = await import("@/entrypoints/extract-channel");
            const spec = mod.default as unknown as () => Promise<unknown>;
            expect(await spec()).toEqual([
                {
                    channelId: "UCUPLOADERXXXXXXXXXXXXX",
                    channelTitle: "Uploader",
                    playlists: [
                        { listId: "PLUCUPLOADERXXXXXXXXXXXXX", name: "UCUPLOADERXXXXXXXXXXXXX" },
                    ],
                },
                {
                    channelId: "UCGUESTXXXXXXXXXXXXXXXX",
                    channelTitle: "Guest",
                    playlists: [
                        { listId: "PLUCGUESTXXXXXXXXXXXXXXXX", name: "UCGUESTXXXXXXXXXXXXXXXX" },
                    ],
                },
            ]);
        });
    });
});
