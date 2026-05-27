import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractYtInitialData, parseChannelInfo, parsePlaylistsTab } from "./parse-channel-info";

const FIXTURE_DIR = join(__dirname, "..", "..", "test", "fixtures");

function loadFixture(name: string): string {
    return readFileSync(join(FIXTURE_DIR, name), "utf8");
}

function extractYtInitialDataFromString(html: string): unknown {
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
    if (!match || match[1] === undefined) {
        throw new Error("ytInitialData not found in fixture");
    }
    return JSON.parse(match[1]);
}

function parseHtmlToDocument(html: string): Document {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("parseChannelInfo – ytInitialData path", () => {
    it("extracts channelId, title, and named playlists from a handle page", () => {
        const html = loadFixture("mkbhd-handle.html");
        const info = parseChannelInfo({ ytInitialData: extractYtInitialDataFromString(html) });

        expect(info).not.toBeNull();
        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(info?.channelTitle).toBe("Marques Brownlee");
        expect(info?.playlists.length).toBeGreaterThan(0);
        // Named playlists carry real PL-prefixed IDs from the shelfRenderer
        // browse endpoints; system IDs (UU/UULF/UUSH/UULV) are filtered out.
        for (const playlist of info?.playlists ?? []) {
            expect(playlist.listId).toMatch(/^PL/);
            expect(playlist.name.length).toBeGreaterThan(0);
        }
    });

    it("extracts channelId from the canonical /channel/UC… URL", () => {
        const html = loadFixture("mkbhd-channel-id.html");
        const info = parseChannelInfo({ ytInitialData: extractYtInitialDataFromString(html) });

        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(info?.channelTitle).toBe("Marques Brownlee");
    });

    it("resolves channelId from a watch page via videoOwnerRenderer", () => {
        const html = loadFixture("mkbhd-watch.html");
        const info = parseChannelInfo({ ytInitialData: extractYtInitialDataFromString(html) });

        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(info?.channelTitle).toBe("Marques Brownlee");
        // Watch pages don't expose the channel's named playlists; we surface
        // the 4 system rows only.
        expect(info?.playlists).toEqual([]);
    });

    it("resolves channelId from a playlist page via videoOwnerRenderer", () => {
        const html = loadFixture("mkbhd-playlist.html");
        const info = parseChannelInfo({ ytInitialData: extractYtInitialDataFromString(html) });

        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(info?.channelTitle).toBe("Marques Brownlee");
        expect(info?.playlists).toEqual([]);
    });

    it("handles a channel with no Shorts (zero impact on parser output)", () => {
        const html = loadFixture("no-shorts-channel.html");
        const info = parseChannelInfo({ ytInitialData: extractYtInitialDataFromString(html) });

        expect(info?.channelId).toBe("UC9-y-6csu5WGm29I7JiwpnA");
        expect(info?.channelTitle).toBe("Computerphile");
        // Shorts row absence is handled downstream; parser still returns
        // a valid ChannelInfo.
    });
});

describe("parseChannelInfo – DOM fallback", () => {
    it("falls back to microdata when ytInitialData is absent", () => {
        const html = loadFixture("mkbhd-handle.html");
        const doc = parseHtmlToDocument(html);
        const info = parseChannelInfo({ document: doc });

        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
        expect(info?.channelTitle).toBe("Marques Brownlee");
        // DOM fallback can't read the Home-tab shelves; named playlists empty.
        expect(info?.playlists).toEqual([]);
    });

    it("falls back to DOM when ytInitialData is non-object", () => {
        const html = loadFixture("mkbhd-channel-id.html");
        const doc = parseHtmlToDocument(html);
        const info = parseChannelInfo({ ytInitialData: "not-an-object", document: doc });

        expect(info?.channelId).toBe("UCBJycsmduvYEL83R_U4JriQ");
    });

    it("falls back to DOM when ytInitialData is missing the channel owner", () => {
        const html = loadFixture("no-shorts-channel.html");
        const doc = parseHtmlToDocument(html);
        // Provide an empty object so the JSON path short-circuits to DOM.
        const info = parseChannelInfo({ ytInitialData: {}, document: doc });

        expect(info?.channelId).toBe("UC9-y-6csu5WGm29I7JiwpnA");
        expect(info?.channelTitle).toBe("Computerphile");
    });
});

describe("parseChannelInfo – failure modes", () => {
    it("returns null when both sources are absent", () => {
        expect(parseChannelInfo({})).toBeNull();
    });

    it("returns null when ytInitialData and document are both empty", () => {
        const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
        expect(parseChannelInfo({ ytInitialData: null, document: doc })).toBeNull();
    });

    it("returns null when JSON has an owner but the ID is not UC-prefixed", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "NOT-A-UC-ID",
                    title: "Bogus Channel",
                },
            },
        };
        expect(parseChannelInfo({ ytInitialData: data })).toBeNull();
    });

    it("returns null when channelMetadataRenderer has no title", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCBJycsmduvYEL83R_U4JriQ",
                },
            },
        };
        expect(parseChannelInfo({ ytInitialData: data })).toBeNull();
    });

    it("returns null when videoOwnerRenderer has no browseId", () => {
        const data = {
            contents: {
                twoColumnWatchNextResults: {
                    results: {
                        results: {
                            contents: [
                                {
                                    videoSecondaryInfoRenderer: {
                                        owner: {
                                            videoOwnerRenderer: {
                                                title: { runs: [{ text: "Some Channel" }] },
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        };
        expect(parseChannelInfo({ ytInitialData: data })).toBeNull();
    });
});

describe("parsePlaylistsTab – Playlists-tab grid", () => {
    it("extracts every PL playlist from the captured MKBHD playlists tab", () => {
        const doc = parseHtmlToDocument(loadFixture("mkbhd-playlists-tab.html"));
        const data = extractYtInitialData(doc);
        const playlists = parsePlaylistsTab(data);

        expect(playlists.length).toBeGreaterThanOrEqual(20);
        for (const p of playlists) {
            expect(p.listId).toMatch(/^PL/);
            expect(p.name.length).toBeGreaterThan(0);
        }
        // Sanity-check a couple of known entries.
        const names = playlists.map((p) => p.name);
        expect(names).toContain("Reviews!");
        expect(names).toContain("Dope Tech!");
        // Favorites (FL prefix) and Watch Later (WL) are filtered out.
        expect(playlists.find((p) => p.listId.startsWith("FL"))).toBeUndefined();
    });

    it("returns empty when ytInitialData is not a record", () => {
        expect(parsePlaylistsTab(null)).toEqual([]);
        expect(parsePlaylistsTab("string")).toEqual([]);
        expect(parsePlaylistsTab(42)).toEqual([]);
    });

    it("returns empty when tabs is not an array", () => {
        expect(
            parsePlaylistsTab({
                contents: { twoColumnBrowseResultsRenderer: { tabs: "nope" } },
            }),
        ).toEqual([]);
    });

    it("skips tabs without sectionListRenderer content", () => {
        expect(
            parsePlaylistsTab({
                contents: {
                    twoColumnBrowseResultsRenderer: {
                        tabs: [{ tabRenderer: {} }],
                    },
                },
            }),
        ).toEqual([]);
    });

    it("supports the legacy gridPlaylistRenderer shape", () => {
        const data = {
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
                                                    playlistId: "PLGRID001",
                                                    title: { simpleText: "Legacy Grid" },
                                                },
                                            },
                                            {
                                                gridPlaylistRenderer: {
                                                    playlistId: "PLGRID002",
                                                    title: { runs: [{ text: "Run Title" }] },
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
        expect(parsePlaylistsTab(data)).toEqual([
            { listId: "PLGRID001", name: "Legacy Grid" },
            { listId: "PLGRID002", name: "Run Title" },
        ]);
    });

    it("skips lockups whose contentType is not playlist", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    sectionListRenderer: {
                                        contents: [
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
                                                    contentId: "PLVIDEO",
                                                    metadata: {
                                                        lockupMetadataViewModel: {
                                                            title: { content: "Not a playlist" },
                                                        },
                                                    },
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
        expect(parsePlaylistsTab(data)).toEqual([]);
    });

    it("skips lockups whose contentId is missing a PL prefix", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    sectionListRenderer: {
                                        contents: [
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                    contentId: "FLPRIVATEXX",
                                                    metadata: {
                                                        lockupMetadataViewModel: {
                                                            title: { content: "Favorites" },
                                                        },
                                                    },
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
        expect(parsePlaylistsTab(data)).toEqual([]);
    });

    it("skips lockups whose title is missing", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    sectionListRenderer: {
                                        contents: [
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                    contentId: "PLNOTITLE",
                                                    metadata: {},
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
        expect(parsePlaylistsTab(data)).toEqual([]);
    });

    it("deduplicates repeated contentIds", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    sectionListRenderer: {
                                        contents: [
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                    contentId: "PLDUP001",
                                                    metadata: {
                                                        lockupMetadataViewModel: {
                                                            title: { content: "First" },
                                                        },
                                                    },
                                                },
                                            },
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                    contentId: "PLDUP001",
                                                    metadata: {
                                                        lockupMetadataViewModel: {
                                                            title: { content: "Second" },
                                                        },
                                                    },
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
        expect(parsePlaylistsTab(data)).toEqual([{ listId: "PLDUP001", name: "First" }]);
    });

    it("skips grid renderers whose playlistId is missing PL prefix", () => {
        const data = {
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
                                                    playlistId: "UUNOTPL",
                                                    title: { simpleText: "System" },
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
        expect(parsePlaylistsTab(data)).toEqual([]);
    });

    it("skips grid renderers whose title is empty", () => {
        const data = {
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
                                                    playlistId: "PLNOTITLE",
                                                    title: {},
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
        expect(parsePlaylistsTab(data)).toEqual([]);
    });

    it("dedupes across the lockup and grid shapes", () => {
        const data = {
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: [
                        {
                            tabRenderer: {
                                content: {
                                    sectionListRenderer: {
                                        contents: [
                                            {
                                                lockupViewModel: {
                                                    contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                                                    contentId: "PLSAME001",
                                                    metadata: {
                                                        lockupMetadataViewModel: {
                                                            title: { content: "Lockup" },
                                                        },
                                                    },
                                                },
                                            },
                                            {
                                                gridPlaylistRenderer: {
                                                    playlistId: "PLSAME001",
                                                    title: { simpleText: "Grid" },
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
        expect(parsePlaylistsTab(data)).toEqual([{ listId: "PLSAME001", name: "Lockup" }]);
    });
});

describe("extractYtInitialData – inline-script fallback", () => {
    it("recovers ytInitialData from a captured handle page's inline script", () => {
        const doc = parseHtmlToDocument(loadFixture("mkbhd-handle.html"));
        const data = extractYtInitialData(doc) as {
            metadata?: { channelMetadataRenderer?: { externalId?: string } };
        };
        expect(data?.metadata?.channelMetadataRenderer?.externalId).toBe(
            "UCBJycsmduvYEL83R_U4JriQ",
        );
    });

    it("recovers ytInitialData on watch pages too", () => {
        const doc = parseHtmlToDocument(loadFixture("mkbhd-watch.html"));
        const data = extractYtInitialData(doc);
        expect(data).not.toBeNull();
        expect(typeof data).toBe("object");
    });

    it("returns null when no script carries the marker", () => {
        const doc = parseHtmlToDocument("<html><body><p>nothing here</p></body></html>");
        expect(extractYtInitialData(doc)).toBeNull();
    });

    it("ignores scripts that contain the marker but no following object", () => {
        const doc = parseHtmlToDocument(
            "<html><body><script>var ytInitialData = ;</script></body></html>",
        );
        expect(extractYtInitialData(doc)).toBeNull();
    });

    it("ignores scripts whose ytInitialData JSON fails to parse", () => {
        const doc = parseHtmlToDocument(
            "<html><body><script>var ytInitialData = {not valid json};</script></body></html>",
        );
        expect(extractYtInitialData(doc)).toBeNull();
    });

    it("skips empty script tags and finds the next match", () => {
        const doc = parseHtmlToDocument(
            `<html><body>
                <script></script>
                <script>var ytInitialData = {"channelId":"UCFOUND"};</script>
            </body></html>`,
        );
        expect(extractYtInitialData(doc)).toEqual({ channelId: "UCFOUND" });
    });

    it("handles quoted strings containing braces and backslashes", () => {
        const doc = parseHtmlToDocument(
            `<html><body><script>var ytInitialData = {"text":"a } \\\\ \\" still string","ok":true};</script></body></html>`,
        );
        expect(extractYtInitialData(doc)).toEqual({
            text: 'a } \\ " still string',
            ok: true,
        });
    });

    it("ignores scripts that have the marker but no opening brace", () => {
        const doc = parseHtmlToDocument(
            "<html><body><script>var ytInitialData = null;</script></body></html>",
        );
        expect(extractYtInitialData(doc)).toBeNull();
    });

    it("ignores scripts whose object braces never close", () => {
        const doc = parseHtmlToDocument(
            '<html><body><script>var ytInitialData = {"a":"b"</script></body></html>',
        );
        expect(extractYtInitialData(doc)).toBeNull();
    });
});

describe("parseChannelInfo – playlist filtering", () => {
    it("skips shelves without a VL-prefixed browseId", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCXXXXXXXXXXXXXXXXXXXXXX",
                    title: "Synth Channel",
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
                                            // Section 0: no shelfRenderer (e.g. video player)
                                            {
                                                itemSectionRenderer: {
                                                    contents: [{ channelVideoPlayerRenderer: {} }],
                                                },
                                            },
                                            // Section 1: shelf with engagement-panel endpoint (not VL…)
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                title: {
                                                                    runs: [{ text: "Approved" }],
                                                                },
                                                                endpoint: {
                                                                    showEngagementPanelEndpoint: {},
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 2: real PL playlist – KEEP
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                title: {
                                                                    runs: [
                                                                        { text: "Real Playlist" },
                                                                    ],
                                                                },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLABCDEFG",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 3: VLUU system playlist – DROP
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                title: {
                                                                    runs: [{ text: "Uploads" }],
                                                                },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLUUXXX",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 4: duplicate of section 2 – DROP
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                title: {
                                                                    runs: [
                                                                        {
                                                                            text: "Real Playlist Again",
                                                                        },
                                                                    ],
                                                                },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLABCDEFG",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 5: shelf with no title – DROP
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLNOTITLE",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 6: VL prefix but empty list ID – DROP
                                            {
                                                itemSectionRenderer: {
                                                    contents: [
                                                        {
                                                            shelfRenderer: {
                                                                title: {
                                                                    runs: [{ text: "Empty" }],
                                                                },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VL",
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Section 7: items array missing
                                            { itemSectionRenderer: {} },
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        };
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([{ listId: "PLABCDEFG", name: "Real Playlist" }]);
    });

    it("returns empty playlists when the tab structure is missing", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCQQQQQQQQQQQQQQQQQQQQQQ",
                    title: "Tabless",
                },
            },
            contents: {},
        };
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([]);
    });

    it("uses simpleText titles when the shelf lacks runs", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCSIMPLEXXXXXXXXXXXXXXXX",
                    title: "Simple",
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
                                                                title: { simpleText: "Plain" },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLPLAIN",
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
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([{ listId: "PLPLAIN", name: "Plain" }]);
    });

    it("skips shelf titles where runs is non-array (defensive branch)", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCRUNSBADXXXXXXXXXXXXXXX",
                    title: "Bad Runs",
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
                                                                title: { runs: "not-an-array" },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLBAD",
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
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([]);
    });

    it("short-circuits readPath when a numeric step targets a non-array", () => {
        // `tabs` is a string – the numeric `[0]` step bails out.
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCNOTABSXXXXXXXXXXXXXXXX",
                    title: "No Tabs Array",
                },
            },
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: "not-an-array",
                },
            },
        };
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([]);
    });

    it("short-circuits readPath when a string step targets a non-record", () => {
        // `tabs[0]` resolves to a string – the next `tabRenderer` step bails.
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCNOTABRENDXXXXXXXXXXXXX",
                    title: "Tab Is String",
                },
            },
            contents: {
                twoColumnBrowseResultsRenderer: {
                    tabs: ["not-a-record"],
                },
            },
        };
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([]);
    });

    it("skips shelf titles whose runs have no text", () => {
        const data = {
            metadata: {
                channelMetadataRenderer: {
                    externalId: "UCEMPTYRUNSXXXXXXXXXXXXX",
                    title: "Empty Runs",
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
                                                                    runs: [{}, "not-a-record"],
                                                                },
                                                                endpoint: {
                                                                    browseEndpoint: {
                                                                        browseId: "VLPLNORUNS",
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
        const info = parseChannelInfo({ ytInitialData: data });
        expect(info?.playlists).toEqual([]);
    });
});
