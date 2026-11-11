// The UULF/UUSH/UULV prefixes are undocumented and may change.
// See https://blog.amen6.com/blog/2025/01/no-shorts-please-hidden-youtube-rss-feed-urls/

declare const brand: unique symbol;

/** A `UC…` channel ID. Construct via `isChannelId` (guard) or `asChannelId`. */
export type ChannelId = string & { readonly [brand]: "ChannelId" };

/**
 * A playlist ID as accepted by the `playlist_id=` feed param: `PL…` named
 * playlists scraped from the page, or the `UU…`-derived system lists built
 * here. Construct via `asListId` after a boundary check.
 */
export type ListId = string & { readonly [brand]: "ListId" };

const CHANNEL_PREFIX = "UC";
const FEED_BASE = "https://www.youtube.com/feeds/videos.xml";

export function isChannelId(value: string): value is ChannelId {
    return value.startsWith(CHANNEL_PREFIX);
}

export function asChannelId(value: string): ChannelId {
    if (!isChannelId(value)) {
        throw new Error(`channelId must start with "${CHANNEL_PREFIX}"; got "${value}"`);
    }
    return value;
}

function isListId(value: string): value is ListId {
    return value.length > 0 && !value.startsWith(CHANNEL_PREFIX);
}

export function asListId(value: string): ListId {
    if (isListId(value)) return value;
    throw new Error(
        value.length === 0
            ? "listId must be non-empty"
            : `listId must not be a "${CHANNEL_PREFIX}" channel id; got "${value}"`,
    );
}

function stripChannelPrefix(channelId: ChannelId): string {
    return channelId.slice(CHANNEL_PREFIX.length);
}

/** UC… → UULF… (long-form videos only; excludes Shorts and Live). */
export function longFormListId(channelId: ChannelId): ListId {
    return asListId(`UULF${stripChannelPrefix(channelId)}`);
}

/** UC… → UUSH… (Shorts only). */
export function shortsListId(channelId: ChannelId): ListId {
    return asListId(`UUSH${stripChannelPrefix(channelId)}`);
}

/** UC… → UULV… (Live broadcasts only). */
export function liveListId(channelId: ChannelId): ListId {
    return asListId(`UULV${stripChannelPrefix(channelId)}`);
}

export function channelFeedUrl(channelId: ChannelId): URL {
    const url = new URL(FEED_BASE);
    url.searchParams.set("channel_id", channelId);
    return url;
}

export function playlistFeedUrl(listId: ListId): URL {
    const url = new URL(FEED_BASE);
    url.searchParams.set("playlist_id", listId);
    return url;
}
