// Nightly selector canary. Re-fetches live YouTube HTML and asserts that both
// extraction paths still work:
//   - the ytInitialData JSON parser (`parseChannelInfo` / `parsePlaylistsTab`),
//     the primary path used in the extension, and
//   - the DOM selector chain (`selfTest`), the fallback path.
// When YouTube ships a layout change that breaks a path, this flips to red and
// the selector-canary workflow opens a GitHub issue – early warning before
// users hit an empty popup.
//
// Failure classes:
//   - Skip (job stays green, warning annotation): transient fetch trouble –
//     HTTP 429, HTTP 5xx after retries, network-level errors (ECONNRESET, DNS,
//     TLS), and per-fetch timeouts. Infrastructure noise, not a regression.
//   - Fail (job red, issue filed): other 4xx (403 = runner bot-blocked, 404 =
//     fixture rot – both need a human) and assertion failures (real
//     parser/selector regressions).
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
const FETCH_TIMEOUT_MS = 20_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// The fetch stayed unavailable after all retries – 429, 5xx, or a
// network-level error. That's infrastructure noise (rate limiting, outage,
// datacenter-IP bot-block), not a layout change. Tests skip on this instead of
// failing so the canary workflow only files issues for real selector/parser
// regressions. The message carries the cause (HTTP status or network error).
class FetchUnavailableError extends Error {}

// `response` is absent for network-level errors – no Retry-After to honor, so
// they always take the exponential branch.
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
                // A stalled fetch counts as a network-level (skip-class) error:
                // AbortSignal.timeout rejects with TimeoutError, caught below.
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
        } catch (error) {
            // Network-level rejection (ECONNRESET, DNS, TLS) or per-fetch
            // timeout: same transient class as 429/5xx – backoff and retry.
            lastCause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            if (attempt === MAX_ATTEMPTS) {
                throw new FetchUnavailableError(
                    `GET ${path} -> ${lastCause} after ${attempt} attempts`,
                );
            }
            await sleep(retryDelayMs(attempt));
            continue;
        }
        if (response.ok) {
            return response.text();
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
            throw new FetchUnavailableError(`GET ${path} -> HTTP ${response.status} after ${attempt} attempts`);
        }
        await sleep(retryDelayMs(attempt, response));
    }
    throw new FetchUnavailableError(`GET ${path} -> ${lastCause}`); // unreachable; satisfies the type checker
}

// `ctx.skip` shows up as a skipped test (vitest still exits 0), so a night with
// transient fetch trouble stays green while real failures keep failing the job.
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
        const playlists = parsePlaylistsTab(extractYtInitialData(parse(html)));
        expect(playlists.length).toBeGreaterThan(0);
        expect(playlists[0]?.listId).toMatch(/^PL/);
    });
});
