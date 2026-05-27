// Pure helpers for YouTube channel/playlist ID transforms and feed URL building.
// The UULF / UUSH / UULV prefixes are reverse-engineered (undocumented) and may
// change without notice; UU (uploads) is the only guaranteed-stable mapping.
// See: https://blog.amen6.com/blog/2025/01/no-shorts-please-hidden-youtube-rss-feed-urls/

const CHANNEL_PREFIX = "UC";
const FEED_BASE = "https://www.youtube.com/feeds/videos.xml";

function requireChannelId(channelId: string): string {
    if (!channelId.startsWith(CHANNEL_PREFIX)) {
        throw new Error(`channelId must start with "${CHANNEL_PREFIX}"; got "${channelId}"`);
    }
    return channelId.slice(CHANNEL_PREFIX.length);
}

/** UC… → UU… (canonical "all uploads" playlist). */
export function uploadsListId(channelId: string): string {
    return `UU${requireChannelId(channelId)}`;
}

/** UC… → UULF… (long-form videos only; excludes Shorts and Live). */
export function longFormListId(channelId: string): string {
    return `UULF${requireChannelId(channelId)}`;
}

/** UC… → UUSH… (Shorts only). */
export function shortsListId(channelId: string): string {
    return `UUSH${requireChannelId(channelId)}`;
}

/** UC… → UULV… (Live broadcasts only). */
export function liveListId(channelId: string): string {
    return `UULV${requireChannelId(channelId)}`;
}

/** Build the RSS feed URL for a channel's default uploads stream. */
export function channelFeedUrl(channelId: string): URL {
    const url = new URL(FEED_BASE);
    url.searchParams.set("channel_id", channelId);
    return url;
}

/** Build the RSS feed URL for an arbitrary playlist. */
export function playlistFeedUrl(listId: string): URL {
    const url = new URL(FEED_BASE);
    url.searchParams.set("playlist_id", listId);
    return url;
}
