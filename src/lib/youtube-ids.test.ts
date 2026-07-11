import { describe, expect, it } from "vitest";
import {
    asChannelId,
    asListId,
    channelFeedUrl,
    liveListId,
    longFormListId,
    playlistFeedUrl,
    shortsListId,
    uploadsListId,
} from "./youtube-ids";

const CHANNEL = asChannelId("UCBJycsmduvYEL83R_U4JriQ");
const SUFFIX = "BJycsmduvYEL83R_U4JriQ";

describe("asChannelId", () => {
    it("accepts a UC-prefixed id", () => {
        expect(asChannelId(`UC${SUFFIX}`)).toBe(`UC${SUFFIX}`);
    });

    it("throws on a non-UC channel id", () => {
        expect(() => asChannelId("PLBCF2DAC6FFB574DE")).toThrow(/must start with "UC"/);
    });

    it("rejects a plain string at compile time", () => {
        // @ts-expect-error a raw string is not a ChannelId
        expect(() => uploadsListId("UCnotBranded")).not.toThrow();
    });
});

describe("asListId", () => {
    it("throws on an empty id", () => {
        expect(() => asListId("")).toThrow(/non-empty/);
    });
});

describe("uploadsListId", () => {
    it("replaces UC prefix with UU", () => {
        expect(uploadsListId(CHANNEL)).toBe(`UU${SUFFIX}`);
    });
});

describe("longFormListId", () => {
    it("replaces UC prefix with UULF", () => {
        expect(longFormListId(CHANNEL)).toBe(`UULF${SUFFIX}`);
    });
});

describe("shortsListId", () => {
    it("replaces UC prefix with UUSH", () => {
        expect(shortsListId(CHANNEL)).toBe(`UUSH${SUFFIX}`);
    });
});

describe("liveListId", () => {
    it("replaces UC prefix with UULV", () => {
        expect(liveListId(CHANNEL)).toBe(`UULV${SUFFIX}`);
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
        const url = playlistFeedUrl(asListId(`UULF${SUFFIX}`));
        expect(url.toString()).toBe(
            `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${SUFFIX}`,
        );
    });
});
