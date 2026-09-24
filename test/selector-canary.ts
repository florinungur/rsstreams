// Live-YouTube check of the ytInitialData parser and the DOM selector chain.
// Transient fetch trouble (429, 5xx, network errors, timeouts) skips; other
// 4xx and assertion failures fail and file an issue. Named without `.test` so
// the unit suite skips it; vitest.canary.config.ts includes it.

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
const FETCH_TIMEOUT_MS = 20_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// A transient fetch failure after every retry; tests skip on it.
class FetchUnavailableError extends Error {}

function retryDelayMs(attempt: number, response?: Response): number {
    // Honor Retry-After when present (delta-seconds or HTTP-date per RFC 9110).
    const header = response?.headers.get("retry-after");
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
    let lastCause = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let response: Response;
        try {
            response = await fetch(`https://www.youtube.com${path}`, {
                headers: {
                    // Mimic real Firefox so YouTube serves the same markup (and keeps
                    // ytInitialData inline). The CONSENT cookie suppresses the EU
                    // interstitial, which otherwise strips ytInitialData.
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "en-US,en;q=0.5",
                    Cookie: "CONSENT=YES+",
                },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (response.ok) {
                // A body read can fail the same transient ways, so it stays
                // inside the try.
                return await response.text();
            }
        } catch (error) {
            lastCause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            if (attempt === MAX_ATTEMPTS) {
                throw new FetchUnavailableError(
                    `GET ${path} -> ${lastCause} after ${attempt} attempts`,
                );
            }
            await sleep(retryDelayMs(attempt));
            continue;
        }
        lastCause = `HTTP ${response.status}`;
        const transient = response.status === 429 || response.status >= 500;
        if (!transient) {
            // Deliberately NOT skip-class: 403 = runner bot-blocked, 404 = the
            // pinned video/channel is gone. Skipping these would keep the job
            // green forever while the canary is blind – a human must look.
            throw new Error(`GET ${path} -> HTTP ${response.status}`);
        }
        if (attempt === MAX_ATTEMPTS) {
            throw new FetchUnavailableError(
                `GET ${path} -> HTTP ${response.status} after ${attempt} attempts`,
            );
        }
        await sleep(retryDelayMs(attempt, response));
    }
    throw new FetchUnavailableError(`GET ${path} -> ${lastCause}`); // unreachable; satisfies the type checker
}

async function fetchYouTubeOrSkip(ctx: TestContext, path: string): Promise<string> {
    try {
        return await fetchYouTube(path);
    } catch (error) {
        if (error instanceof FetchUnavailableError) {
            ctx.skip(`fetch unavailable: ${error.message}`);
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
        // YouTube sometimes serves this tab with no playlists. A JSON key rename
        // still leaves `list=PL` links in the markup, so only a page with none
        // skips.
        if (!/list=PL/.test(html)) {
            ctx.skip("playlists tab served without any playlist entries");
        }
        const playlists = parsePlaylistsTab(extractYtInitialData(parse(html)));
        expect(playlists.length).toBeGreaterThan(0);
        expect(playlists[0]?.listId).toMatch(/^PL/);
    });
});
