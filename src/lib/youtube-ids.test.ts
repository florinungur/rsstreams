import { describe, expect, it } from "vitest";
import {
    channelFeedUrl,
    liveListId,
    longFormListId,
    playlistFeedUrl,
    shortsListId,
    uploadsListId,
} from "./youtube-ids";

const CHANNEL = "UCBJycsmduvYEL83R_U4JriQ";
const SUFFIX = "BJycsmduvYEL83R_U4JriQ";

describe("uploadsListId", () => {
    it("replaces UC prefix with UU", () => {
        expect(uploadsListId(CHANNEL)).toBe(`UU${SUFFIX}`);
    });

    it("throws on a non-UC channel id", () => {
        expect(() => uploadsListId("PLBCF2DAC6FFB574DE")).toThrow(/must start with "UC"/);
    });
});

describe("longFormListId", () => {
    it("replaces UC prefix with UULF", () => {
        expect(longFormListId(CHANNEL)).toBe(`UULF${SUFFIX}`);
    });

    it("throws on a non-UC channel id", () => {
        expect(() => longFormListId("FOO")).toThrow();
    });
});

describe("shortsListId", () => {
    it("replaces UC prefix with UUSH", () => {
        expect(shortsListId(CHANNEL)).toBe(`UUSH${SUFFIX}`);
    });

    it("throws on a non-UC channel id", () => {
        expect(() => shortsListId("FOO")).toThrow();
    });
});

describe("liveListId", () => {
    it("replaces UC prefix with UULV", () => {
        expect(liveListId(CHANNEL)).toBe(`UULV${SUFFIX}`);
    });

    it("throws on a non-UC channel id", () => {
        expect(() => liveListId("FOO")).toThrow();
    });
});

describe("channelFeedUrl", () => {
    it("builds the channel-id feed URL", () => {
        const url = channelFeedUrl(CHANNEL);
        expect(url.toString()).toBe(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`,
        );
    });
});

describe("playlistFeedUrl", () => {
    it("builds the playlist-id feed URL", () => {
        const url = playlistFeedUrl(`UULF${SUFFIX}`);
        expect(url.toString()).toBe(
            `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${SUFFIX}`,
        );
    });
});
