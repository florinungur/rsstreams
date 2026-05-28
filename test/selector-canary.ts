// Nightly selector canary. Re-fetches live YouTube HTML and asserts that both
// extraction paths still work:
//   - the ytInitialData JSON parser (`parseChannelInfo` / `parsePlaylistsTab`),
//     the primary path used in the extension, and
//   - the DOM selector chain (`selfTest`), the fallback path.
// When YouTube ships a layout change that breaks a path, this flips to red and
// the selector-canary workflow opens a GitHub issue – early warning before
// users hit an empty popup. Run via `pnpm test:canary` (NOT the unit suite).
//
// This file is intentionally named `*.ts` (not `*.test.ts`) so the default
// vitest config never picks it up; vitest.canary.config.ts includes it
// explicitly.

import { describe, expect, it } from "vitest";
import {
    extractYtInitialData,
    parseChannelInfo,
    parsePlaylistsTab,
} from "@/lib/parse-channel-info";
import { selfTest } from "@/lib/selectors";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ"; // Marques Brownlee
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

async function fetchYouTube(path: string): Promise<string> {
    const response = await fetch(`https://www.youtube.com${path}`, {
        headers: {
            // Mimic real Firefox so YouTube serves the same markup (and keeps
            // ytInitialData inline). The CONSENT cookie suppresses the EU
            // interstitial, which otherwise strips ytInitialData.
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.5",
            Cookie: "CONSENT=YES+",
        },
    });
    if (!response.ok) {
        throw new Error(`GET ${path} -> HTTP ${response.status}`);
    }
    return response.text();
}

function parse(html: string): Document {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("selector canary (live YouTube)", () => {
    it("channel page: DOM self-test + ytInitialData parse resolve the channel", async () => {
        const html = await fetchYouTube(`/channel/${CHANNEL_ID}`);
        const doc = parse(html);

        const selectors = selfTest(html);
        expect(selectors.healthy, "DOM selector chain regressed").toBe(true);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toBe(CHANNEL_ID);
        expect((info?.channelTitle ?? "").length).toBeGreaterThan(0);
    });

    it("handle page: DOM self-test + ytInitialData parse resolve the channel", async () => {
        const html = await fetchYouTube("/@MKBHD");
        const doc = parse(html);

        expect(selfTest(html).healthy, "DOM selector chain regressed").toBe(true);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toBe(CHANNEL_ID);
    });

    it("watch page: ytInitialData parse resolves the channel (JSON-only path)", async () => {
        const html = await fetchYouTube("/watch?v=_02K6efDLI0");
        const doc = parse(html);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toMatch(/^UC/);
    });

    it("playlists tab: parsePlaylistsTab yields at least one named playlist", async () => {
        const html = await fetchYouTube(`/channel/${CHANNEL_ID}/playlists`);
        const playlists = parsePlaylistsTab(extractYtInitialData(parse(html)));
        expect(playlists.length).toBeGreaterThan(0);
        expect(playlists[0]?.listId).toMatch(/^PL/);
    });
});
