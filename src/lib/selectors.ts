// DOM fallback for parse-channel-info. Channel and handle pages carry
// `<meta itemprop="identifier">` and `<meta itemprop="name">`; watch and
// playlist pages carry no channel microdata and resolve through ytInitialData.

import { type ChannelId, isChannelId } from "./youtube-ids";

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
        // Reads the first `link[itemprop=url]` only; an @handle href there
        // yields nothing.
        extract: (el) => extractChannelIdFromHref(el.getAttribute("href")),
    },
    {
        name: "ytd-channel-name-a",
        selector: "ytd-channel-name a",
        extract: (el) => extractChannelIdFromHref(el.getAttribute("href")),
    },
];

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

export function extractDomChannel(doc: Document): ChannelId | null {
    for (const probe of CHANNEL_ID_SELECTORS) {
        const el = doc.querySelector(probe.selector);
        if (!el) continue;
        const value = probe.extract(el);
        if (value && isChannelId(value)) return value;
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

/** Per-probe results for the nightly selector canary. */
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
    return new DOMParser().parseFromString(html, "text/html");
}

function extractChannelIdFromHref(href: string | null): string | null {
    if (!href) return null;
    const match = href.match(/\/channel\/(UC[0-9A-Za-z_-]+)/);
    return match && match[1] ? match[1] : null;
}
