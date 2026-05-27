// DOM selector chain for the page-detector fallback path, plus a self-test
// helper that the Phase 5 canary uses to detect when YouTube ships a layout
// change. The chain is intentionally shallow – ytInitialData is the primary
// path and covers ~all healthy pages – but we still keep multiple DOM probes
// because Mozilla's add-on review reads the source.
//
// Layout notes (verified 2026-05-27 against captured fixtures):
//   - Channel + handle pages expose `<meta itemprop="identifier"
//     content="UC…">` and `<meta itemprop="name" content="…">` from the
//     microformat block; both are stable across the SPA reload.
//   - The legacy `ytd-channel-name` web component is gone from current
//     YouTube but kept in the chain as a "we'd notice if it comes back"
//     marker.
//   - Watch + playlist pages do NOT expose channelId in microdata; that path
//     stays JSON-only.

/**
 * Selectors that yield a `UC…` channel ID when one is present in the DOM.
 * Order: most-specific microdata first, legacy Polymer last.
 */
export const CHANNEL_ID_SELECTORS: ReadonlyArray<{
    name: string;
    selector: string;
    extract: (el: Element) => string | null;
}> = [
    {
        name: "meta-itemprop-identifier",
        selector: 'meta[itemprop="identifier"]',
        extract: (el) => el.getAttribute("content"),
    },
    {
        name: "link-itemprop-url-channel",
        selector: 'link[itemprop="url"]',
        // The owner @handle URL appears as a `<link itemprop="url">`; the
        // canonical channel URL appears as another `<link itemprop="url">`
        // whose href is `https://www.youtube.com/channel/UC…`. We accept
        // either – matching only the `/channel/UC…` shape filters out the
        // @handle variant.
        extract: (el) => extractChannelIdFromHref(el.getAttribute("href")),
    },
    {
        name: "ytd-channel-name-a",
        selector: "ytd-channel-name a",
        extract: (el) => extractChannelIdFromHref(el.getAttribute("href")),
    },
];

/**
 * Selectors that yield the channel title (display name).
 */
export const CHANNEL_TITLE_SELECTORS: ReadonlyArray<{
    name: string;
    selector: string;
    extract: (el: Element) => string | null;
}> = [
    {
        name: "meta-itemprop-name",
        selector: 'meta[itemprop="name"]',
        extract: (el) => el.getAttribute("content"),
    },
    {
        name: "ytd-channel-name-a",
        selector: "ytd-channel-name a",
        extract: (el) => (el.textContent ? el.textContent.trim() : null),
    },
];

/**
 * Run every selector against `doc` and return the first non-empty UC… ID.
 * The selectors module is the only place that touches the DOM directly;
 * `parse-channel-info.ts` uses it as the fallback when ytInitialData is
 * absent or incomplete.
 */
export function extractDomChannel(doc: Document): string | null {
    for (const probe of CHANNEL_ID_SELECTORS) {
        const el = doc.querySelector(probe.selector);
        if (!el) continue;
        const value = probe.extract(el);
        if (value && value.startsWith("UC")) return value;
    }
    return null;
}

export function extractDomTitle(doc: Document): string | null {
    for (const probe of CHANNEL_TITLE_SELECTORS) {
        const el = doc.querySelector(probe.selector);
        if (!el) continue;
        const value = probe.extract(el);
        if (value && value.length > 0) return value;
    }
    return null;
}

export interface SelfTestProbeResult {
    name: string;
    selector: string;
    matched: boolean;
    /** Non-null when the selector both matched and yielded a valid value. */
    value: string | null;
}

export interface SelfTestResult {
    channelId: SelfTestProbeResult[];
    channelTitle: SelfTestProbeResult[];
    /** True when at least one probe in each chain returned a value. */
    healthy: boolean;
}

/**
 * Run every selector against the given HTML string and report per-probe
 * outcomes. The Phase 5 canary workflow re-fetches live YouTube HTML, calls
 * this against each page, and opens a GitHub issue when `healthy` flips to
 * false – early warning that the chain needs widening.
 */
export function selfTest(html: string): SelfTestResult {
    const doc = parseHtml(html);
    const channelId = CHANNEL_ID_SELECTORS.map((probe) => probeOnce(doc, probe, "UC"));
    const channelTitle = CHANNEL_TITLE_SELECTORS.map((probe) => probeOnce(doc, probe, null));
    return {
        channelId,
        channelTitle,
        healthy: channelId.some((p) => p.value) && channelTitle.some((p) => p.value),
    };
}

function probeOnce(
    doc: Document,
    probe: { name: string; selector: string; extract: (el: Element) => string | null },
    requiredPrefix: string | null,
): SelfTestProbeResult {
    const el = doc.querySelector(probe.selector);
    if (!el) {
        return { name: probe.name, selector: probe.selector, matched: false, value: null };
    }
    const raw = probe.extract(el);
    const value = raw && (requiredPrefix === null || raw.startsWith(requiredPrefix)) ? raw : null;
    return { name: probe.name, selector: probe.selector, matched: true, value };
}

function parseHtml(html: string): Document {
    // jsdom's DOMParser is available under vitest's jsdom environment; in the
    // extension runtime it's the browser's native DOMParser. Both behave the
    // same for our microdata-only probes.
    return new DOMParser().parseFromString(html, "text/html");
}

function extractChannelIdFromHref(href: string | null): string | null {
    if (!href) return null;
    const match = href.match(/\/channel\/(UC[0-9A-Za-z_-]+)/);
    return match && match[1] ? match[1] : null;
}
