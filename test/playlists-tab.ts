// Builders for one page of a channel's Playlists tab, in the two shapes YouTube
// sends it.

export const lockup = (contentId: string, name: string): unknown => ({
    lockupViewModel: {
        contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
        contentId,
        metadata: { lockupMetadataViewModel: { title: { content: name } } },
    },
});

export const continuationItem = (token: string): unknown => ({
    continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } },
});

/** The tab's grid as ytInitialData holds it. */
export const tabPage = (items: unknown[]): Record<string, unknown> => ({
    contents: {
        twoColumnBrowseResultsRenderer: {
            tabs: [
                {
                    tabRenderer: {
                        content: {
                            sectionListRenderer: {
                                contents: [
                                    {
                                        itemSectionRenderer: {
                                            contents: [{ gridRenderer: { items } }],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        },
    },
});

/** The same items as a continuation response holds them. */
export const continuationPage = (items: unknown[]): unknown => ({
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: items } }],
});
