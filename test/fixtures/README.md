# Test fixtures

Verbatim HTML captures of public YouTube pages, used by the
`parseChannelInfo` and `selectors` unit tests. Captured 2026-05-27.

| File                      | URL                                                     | Channel                   | Notes                                                                              |
| ------------------------- | ------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `mkbhd-handle.html`       | `https://www.youtube.com/@MKBHD`                        | Marques Brownlee          | Handle URL, Home tab. Exposes ~9 named-playlist shelves via `shelfRenderer` nodes. |
| `mkbhd-channel-id.html`   | `https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ` | Marques Brownlee          | Canonical channel URL. Same content, different routing.                            |
| `mkbhd-watch.html`        | `https://www.youtube.com/watch?v=_02K6efDLI0`           | Marques Brownlee          | Video page. Owner is buried inside `videoOwnerRenderer`, not metadata.             |
| `mkbhd-playlist.html`     | `https://www.youtube.com/playlist?list=PLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y` | Marques Brownlee          | Playlist page ("First Impressions!"). Owner in `playlistSidebarRenderer`.          |
| `no-shorts-channel.html`  | `https://www.youtube.com/@Computerphile`                | Computerphile             | Channel with no Shorts tab – verifies the parser still returns a valid `ChannelInfo`. |

## Re-capturing

The Phase 5 nightly canary workflow re-fetches live HTML at runtime and
fails when the selector chain comes back empty. When that happens, re-run
the capture so the unit tests track the new shape:

```bash
cd test/fixtures
UA="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
for url_name in \
  "https://www.youtube.com/@MKBHD|mkbhd-handle.html" \
  "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ|mkbhd-channel-id.html" \
  "https://www.youtube.com/watch?v=_02K6efDLI0|mkbhd-watch.html" \
  "https://www.youtube.com/playlist?list=PLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y|mkbhd-playlist.html" \
  "https://www.youtube.com/@Computerphile|no-shorts-channel.html"; do
  url="${url_name%|*}"; name="${url_name#*|}"
  curl -sSL -o "$name" \
    -A "$UA" \
    -H "Accept-Language: en-US,en;q=0.5" \
    -H "Cookie: CONSENT=YES+" \
    "$url"
done
```

The `CONSENT=YES+` cookie suppresses the EU consent interstitial, which
otherwise strips `ytInitialData` from the response.

The HTML files are excluded from `oxfmt` via `.prettierignore` – they
must round-trip byte-for-byte to remain valid fixtures.
