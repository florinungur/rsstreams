import {
    type ChannelId,
    channelFeedUrl,
    type ListId,
    liveListId,
    longFormListId,
    playlistFeedUrl,
    shortsListId,
} from "./youtube-ids";

export interface NamedPlaylist {
    listId: ListId;
    name: string;
}

export interface ChannelInfo {
    channelId: ChannelId;
    channelTitle: string;
    playlists: NamedPlaylist[];
}

export type FeedVariant = "uploads" | "long-form" | "shorts" | "live" | "playlist";

export interface FeedRow {
    label: string;
    url: URL;
    variant: FeedVariant;
    /** Present only when variant === "playlist". */
    playlistId?: ListId;
}

export function buildFeeds(info: ChannelInfo): FeedRow[] {
    const { channelId, playlists } = info;

    const rows: FeedRow[] = [
        {
            label: "All uploads",
            url: channelFeedUrl(channelId),
            variant: "uploads",
        },
        {
            label: "Videos (long-form)",
            url: playlistFeedUrl(longFormListId(channelId)),
            variant: "long-form",
        },
        {
            label: "Shorts only",
            url: playlistFeedUrl(shortsListId(channelId)),
            variant: "shorts",
        },
        {
            label: "Live only",
            url: playlistFeedUrl(liveListId(channelId)),
            variant: "live",
        },
    ];

    for (const playlist of playlists) {
        rows.push({
            label: playlist.name,
            url: playlistFeedUrl(playlist.listId),
            variant: "playlist",
            playlistId: playlist.listId,
        });
    }

    return rows;
}
