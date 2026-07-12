// Nightly selector canary. Re-fetches live YouTube HTML and asserts that both
// extraction paths still work:
//   - the ytInitialData JSON parser (`parseChannelInfo` / `parsePlaylistsTab`),
//     the primary path used in the extension, and
//   - the DOM selector chain (`selfTest`), the fallback path.
// When YouTube ships a layout change that breaks a path, this flips to red and
// the selector-canary workflow opens a GitHub issue – early warning before
// users hit an empty popup. Rate limiting (HTTP 429 from the runner IP) skips
// the affected test instead of failing it, so only real regressions go red.
// Run via `pnpm test:canary` (NOT the unit suite).
//
// This file is intentionally named `*.ts` (not `*.test.ts`) so the default
// vitest config never picks it up; vitest.canary.config.ts includes it
// explicitly.

import { describe, expect, it, type TestContext } from "vitest";
import {
    extractYtInitialData,
    parseChannelInfo,
    parsePlaylistsTab,
} from "@/lib/parse-channel-info";
import { selfTest } from "@/lib/selectors";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ"; // Marques Brownlee
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// YouTube kept returning 429 after all retries – the runner IP is rate-limited,
// not a layout change. Tests skip on this instead of failing so the canary
// workflow only files issues for real selector/parser regressions.
class RateLimitError extends Error {}

function retryDelayMs(response: Response, attempt: number): number {
    // Honor Retry-After when present (delta-seconds or HTTP-date per RFC 9110).
    const header = response.headers.get("retry-after");
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) {
            return Math.min(seconds * 1000, 30_000);
        }
        const dateMs = Date.parse(header);
        if (!Number.isNaN(dateMs)) {
            return Math.max(0, Math.min(dateMs - Date.now(), 30_000));
        }
    }
    // Exponential backoff with jitter: 1s, 2s, 4s (+ up to 500ms).
    return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
}

async function fetchYouTube(path: string): Promise<string> {
    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
        if (response.ok) {
            return response.text();
        }
        lastStatus = response.status;
        const transient = response.status === 429 || response.status >= 500;
        if (!transient || attempt === MAX_ATTEMPTS) {
            if (response.status === 429) {
                throw new RateLimitError(`GET ${path} -> HTTP 429 after ${attempt} attempts`);
            }
            throw new Error(`GET ${path} -> HTTP ${response.status}`);
        }
        await sleep(retryDelayMs(response, attempt));
    }
    throw new Error(`GET ${path} -> HTTP ${lastStatus}`); // unreachable; satisfies the type checker
}

// `ctx.skip` shows up as a skipped test (vitest still exits 0), so a rate-limited
// night stays green while real failures keep failing the job.
async function fetchYouTubeOrSkip(ctx: TestContext, path: string): Promise<string> {
    try {
        return await fetchYouTube(path);
    } catch (error) {
        if (error instanceof RateLimitError) {
            ctx.skip(`rate limited: ${error.message}`);
        }
        throw error;
    }
}

function parse(html: string): Document {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("selector canary (live YouTube)", () => {
    it("channel page: DOM self-test + ytInitialData parse resolve the channel", async (ctx) => {
        const html = await fetchYouTubeOrSkip(ctx, `/channel/${CHANNEL_ID}`);
        const doc = parse(html);

        const selectors = selfTest(html);
        expect(selectors.healthy, "DOM selector chain regressed").toBe(true);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toBe(CHANNEL_ID);
        expect((info?.channelTitle ?? "").length).toBeGreaterThan(0);
    });

    it("handle page: DOM self-test + ytInitialData parse resolve the channel", async (ctx) => {
        const html = await fetchYouTubeOrSkip(ctx, "/@MKBHD");
        const doc = parse(html);

        expect(selfTest(html).healthy, "DOM selector chain regressed").toBe(true);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toBe(CHANNEL_ID);
    });

    it("watch page: ytInitialData parse resolves the channel (JSON-only path)", async (ctx) => {
        const html = await fetchYouTubeOrSkip(ctx, "/watch?v=_02K6efDLI0");
        const doc = parse(html);

        const info = parseChannelInfo({ ytInitialData: extractYtInitialData(doc), document: doc });
        expect(info?.channelId).toMatch(/^UC/);
    });

    it("playlists tab: parsePlaylistsTab yields at least one named playlist", async (ctx) => {
        const html = await fetchYouTubeOrSkip(ctx, `/channel/${CHANNEL_ID}/playlists`);
        const playlists = parsePlaylistsTab(extractYtInitialData(parse(html)));
        expect(playlists.length).toBeGreaterThan(0);
        expect(playlists[0]?.listId).toMatch(/^PL/);
    });
});
