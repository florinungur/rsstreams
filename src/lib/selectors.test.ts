import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    CHANNEL_ID_SELECTORS,
    CHANNEL_TITLE_SELECTORS,
    extractDomChannel,
    extractDomTitle,
    selfTest,
} from "./selectors";

const FIXTURE_DIR = join(__dirname, "..", "..", "test", "fixtures");

function loadFixture(name: string): string {
    return readFileSync(join(FIXTURE_DIR, name), "utf8");
}

function parseHtml(html: string): Document {
    return new DOMParser().parseFromString(html, "text/html");
}

describe("DOM extraction – channelId", () => {
    it("reads channelId from meta[itemprop=identifier] on a handle page", () => {
        const doc = parseHtml(loadFixture("mkbhd-handle.html"));
        expect(extractDomChannel(doc)).toBe("UCBJycsmduvYEL83R_U4JriQ");
    });

    it("reads channelId from meta[itemprop=identifier] on a channel-id page", () => {
        const doc = parseHtml(loadFixture("mkbhd-channel-id.html"));
        expect(extractDomChannel(doc)).toBe("UCBJycsmduvYEL83R_U4JriQ");
    });

    it("returns null when no selector matches", () => {
        const doc = parseHtml("<html><body><p>no microdata here</p></body></html>");
        expect(extractDomChannel(doc)).toBeNull();
    });

    it("falls through when meta identifier is not a UC ID (e.g. watch page videoId)", () => {
        // mkbhd-watch.html's first identifier meta is the video ID, not a
        // channel ID. The link[itemprop=url] fallback should still catch
        // the @handle URL... but the @handle URL is not /channel/UC… so the
        // fallback also misses. Result: null.
        const doc = parseHtml(loadFixture("mkbhd-watch.html"));
        expect(extractDomChannel(doc)).toBeNull();
    });

    it("falls back to the link[itemprop=url] /channel/ href when meta identifier missing", () => {
        const html = `<html><body>
            <link itemprop="url" href="https://www.youtube.com/channel/UCABCDEFGHIJKLMNOPQRSTUV">
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomChannel(doc)).toBe("UCABCDEFGHIJKLMNOPQRSTUV");
    });

    it("falls back to ytd-channel-name a /channel/ href (legacy Polymer surface)", () => {
        const html = `<html><body>
            <ytd-channel-name><a href="/channel/UCLEGACYXXXXXXXXXXXXXXXX">x</a></ytd-channel-name>
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomChannel(doc)).toBe("UCLEGACYXXXXXXXXXXXXXXXX");
    });

    it("ignores link[itemprop=url] when the href is an @handle URL", () => {
        const html = `<html><body>
            <link itemprop="url" href="http://www.youtube.com/@somebody">
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomChannel(doc)).toBeNull();
    });

    it("ignores link[itemprop=url] when href attribute is absent", () => {
        const html = `<html><body>
            <link itemprop="url">
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomChannel(doc)).toBeNull();
    });

    it("ignores selectors that match but extract empty string", () => {
        const html = `<html><body>
            <meta itemprop="identifier" content="">
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomChannel(doc)).toBeNull();
    });

    it("ignores meta[itemprop=identifier] when content is missing", () => {
        const html = `<html><body>
            <meta itemprop="identifier">
            <link itemprop="url" href="https://www.youtube.com/channel/UCFALLBACK0123456789XYZ_">
        </body></html>`;
        const doc = parseHtml(html);
        // First selector matches but extracts null (no content attr); chain
        // falls through to the link selector.
        expect(extractDomChannel(doc)).toBe("UCFALLBACK0123456789XYZ_");
    });
});

describe("DOM extraction – channelTitle", () => {
    it("reads title from meta[itemprop=name]", () => {
        const doc = parseHtml(loadFixture("no-shorts-channel.html"));
        expect(extractDomTitle(doc)).toBe("Computerphile");
    });

    it("falls back to ytd-channel-name a text content", () => {
        const html = `<html><body>
            <ytd-channel-name><a>Legacy Channel</a></ytd-channel-name>
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomTitle(doc)).toBe("Legacy Channel");
    });

    it("returns null when no title selector matches", () => {
        const doc = parseHtml("<html><body></body></html>");
        expect(extractDomTitle(doc)).toBeNull();
    });

    it("ignores meta[itemprop=name] when content is empty", () => {
        const html = `<html><body>
            <meta itemprop="name" content="">
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomTitle(doc)).toBeNull();
    });

    it("trims whitespace from ytd-channel-name a textContent fallback", () => {
        const html = `<html><body>
            <ytd-channel-name><a>   Padded Name   </a></ytd-channel-name>
        </body></html>`;
        const doc = parseHtml(html);
        expect(extractDomTitle(doc)).toBe("Padded Name");
    });

    it("returns null from ytd-channel-name a when textContent is null", () => {
        const html = `<html><body>
            <ytd-channel-name><a></a></ytd-channel-name>
        </body></html>`;
        const doc = parseHtml(html);
        // Empty textContent string trims to "" and is rejected (length 0).
        expect(extractDomTitle(doc)).toBeNull();
    });
});

describe("selfTest", () => {
    it("reports healthy chains for a captured handle page", () => {
        const result = selfTest(loadFixture("mkbhd-handle.html"));

        expect(result.healthy).toBe(true);
        expect(result.channelId).toHaveLength(CHANNEL_ID_SELECTORS.length);
        expect(result.channelTitle).toHaveLength(CHANNEL_TITLE_SELECTORS.length);

        // meta-itemprop-identifier should hit and yield the UC ID.
        const identifierProbe = result.channelId.find((p) => p.name === "meta-itemprop-identifier");
        expect(identifierProbe?.matched).toBe(true);
        expect(identifierProbe?.value).toBe("UCBJycsmduvYEL83R_U4JriQ");

        // meta-itemprop-name should hit on the title chain.
        const nameProbe = result.channelTitle.find((p) => p.name === "meta-itemprop-name");
        expect(nameProbe?.matched).toBe(true);
        expect(nameProbe?.value).toBe("Marques Brownlee");

        // The legacy ytd-channel-name selector is gone from current YouTube;
        // record it as unmatched so a future re-introduction surfaces in CI.
        const legacyProbe = result.channelId.find((p) => p.name === "ytd-channel-name-a");
        expect(legacyProbe?.matched).toBe(false);
        expect(legacyProbe?.value).toBeNull();
    });

    it("reports unhealthy when no selector matches", () => {
        const result = selfTest("<html><body></body></html>");
        expect(result.healthy).toBe(false);
        expect(result.channelId.every((p) => !p.matched)).toBe(true);
        expect(result.channelTitle.every((p) => !p.matched)).toBe(true);
    });

    it("reports matched=true but value=null when a selector returns the wrong shape", () => {
        // A meta[itemprop=identifier] with a non-UC ID (e.g. a video ID on a
        // watch page) – the selector hits but the value is rejected by the
        // requiredPrefix gate, leaving matched=true and value=null.
        const html = `<html><body>
            <meta itemprop="identifier" content="dQw4w9WgXcQ">
        </body></html>`;
        const result = selfTest(html);
        const idProbe = result.channelId.find((p) => p.name === "meta-itemprop-identifier");
        expect(idProbe?.matched).toBe(true);
        expect(idProbe?.value).toBeNull();
    });

    it("reports matched=true but value=null when extract returns null", () => {
        // A meta[itemprop=name] without a content attribute – the selector
        // matches but extract returns null; the title chain records that.
        const html = `<html><body>
            <meta itemprop="name">
        </body></html>`;
        const result = selfTest(html);
        const nameProbe = result.channelTitle.find((p) => p.name === "meta-itemprop-name");
        expect(nameProbe?.matched).toBe(true);
        expect(nameProbe?.value).toBeNull();
    });
});
