import { describe, expect, it } from "vitest";
import { buildFeeds, type ChannelInfo, type FeedRow } from "./feed-builder";

const CHANNEL: ChannelInfo = {
    channelId: "UCBJycsmduvYEL83R_U4JriQ",
    channelTitle: "Marques Brownlee",
    playlists: [],
};

describe("buildFeeds", () => {
    it("emits exactly 4 system rows for a channel with no playlists", () => {
        const rows = buildFeeds(CHANNEL);
        expect(rows).toHaveLength(4);
        expect(rows.map((r) => r.variant)).toEqual(["uploads", "long-form", "shorts", "live"]);
    });

    it("uses the canonical channel_id form for the uploads row", () => {
        const rows = buildFeeds(CHANNEL);
        const uploads = rows.find((r) => r.variant === "uploads") as FeedRow;
        expect(uploads.url.toString()).toBe(
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
        );
        expect(uploads.label).toBe("All uploads");
        expect(uploads.playlistId).toBeUndefined();
    });

    it("uses the UULF playlist_id form for the long-form row", () => {
        const rows = buildFeeds(CHANNEL);
        const longForm = rows.find((r) => r.variant === "long-form") as FeedRow;
        expect(longForm.url.toString()).toBe(
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UULFBJycsmduvYEL83R_U4JriQ",
        );
        expect(longForm.label).toBe("Videos (long-form)");
    });

    it("uses the UUSH playlist_id form for the Shorts row", () => {
        const rows = buildFeeds(CHANNEL);
        const shorts = rows.find((r) => r.variant === "shorts") as FeedRow;
        expect(shorts.url.toString()).toBe(
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UUSHBJycsmduvYEL83R_U4JriQ",
        );
        expect(shorts.label).toBe("Shorts only");
    });

    it("uses the UULV playlist_id form for the Live row", () => {
        const rows = buildFeeds(CHANNEL);
        const live = rows.find((r) => r.variant === "live") as FeedRow;
        expect(live.url.toString()).toBe(
            "https://www.youtube.com/feeds/videos.xml?playlist_id=UULVBJycsmduvYEL83R_U4JriQ",
        );
        expect(live.label).toBe("Live only");
    });

    it("appends one playlist row per named playlist, in order", () => {
        const rows = buildFeeds({
            ...CHANNEL,
            playlists: [
                { listId: "PLfirst", name: "First playlist" },
                { listId: "PLsecond", name: "Second playlist" },
            ],
        });

        expect(rows).toHaveLength(6);
        expect(rows.slice(4)).toEqual([
            {
                label: "First playlist",
                url: new URL("https://www.youtube.com/feeds/videos.xml?playlist_id=PLfirst"),
                variant: "playlist",
                playlistId: "PLfirst",
            },
            {
                label: "Second playlist",
                url: new URL("https://www.youtube.com/feeds/videos.xml?playlist_id=PLsecond"),
                variant: "playlist",
                playlistId: "PLsecond",
            },
        ]);
    });
});
