# Test fixtures

Verbatim HTML captures of public YouTube pages, used by the
`parseChannelInfo` and `selectors` unit tests. Capture dates:
`git log --format=%as -- <file>`.

The capture script below is the single source for the URL ↔ file mapping.

| File                           | Channel          | Notes                                                                                                                                                                                          |
| ------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mkbhd-handle.html`            | Marques Brownlee | Handle URL, Home tab. Exposes ~9 named-playlist shelves via `shelfRenderer` nodes.                                                                                                             |
| `mkbhd-channel-id.html`        | Marques Brownlee | Canonical channel URL. Same content, different routing.                                                                                                                                        |
| `mkbhd-watch.html`             | Marques Brownlee | Video page. Owner is buried inside `videoOwnerRenderer`, not metadata.                                                                                                                         |
| `mkbhd-watch-json-script.html` | Marques Brownlee | Same video page in the format YouTube serves to some requests: ytInitialData sits in a `<script id="yt-initial-data" type="application/json">` element, with no inline `var ytInitialData = `. |
| `mkbhd-playlist.html`          | Marques Brownlee | Playlist page ("First Impressions!"). Owner in `playlistSidebarRenderer`.                                                                                                                      |
| `no-shorts-channel.html`       | Computerphile    | Channel with no Shorts tab – verifies the parser still returns a valid `ChannelInfo`.                                                                                                          |
| `mkbhd-playlists-tab.html`     | Marques Brownlee | Playlists tab. Backs `parsePlaylistsTab` – the content script fetches this to surface the canonical playlist grid regardless of which sub-page the user clicked from.                          |

## Re-capturing

The nightly selector-canary workflow re-fetches live HTML at runtime
and fails when the selector chain comes back empty. When that happens,
re-run the capture so the unit tests track the new shape:

```bash
cd test/fixtures
UA="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
# YouTube picks the ytInitialData format per request and sometimes serves
# an empty shell with no <title>, so each capture retries until the page
# has a title and the format its tests read.
capture() {
  local url="$1" name="$2" marker="$3" tries=1000
  for _ in $(seq "$tries"); do
    curl -sSL -o "$name" \
      -A "$UA" \
      -H "Accept-Language: en-US,en;q=0.5" \
      -H "Cookie: SOCS=CAI" \
      "$url" &&
      grep -q '<title>' "$name" && grep -qF "$marker" "$name" && return
    sleep 1
  done
  echo "$url: no '$marker' page after $tries tries" >&2
  return 1
}
for url_name in \
  "https://www.youtube.com/@MKBHD|mkbhd-handle.html" \
  "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ|mkbhd-channel-id.html" \
  "https://www.youtube.com/watch?v=_02K6efDLI0|mkbhd-watch.html" \
  "https://www.youtube.com/playlist?list=PLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y|mkbhd-playlist.html" \
  "https://www.youtube.com/@Computerphile|no-shorts-channel.html" \
  "https://www.youtube.com/@mkbhd/playlists|mkbhd-playlists-tab.html"; do
  capture "${url_name%|*}" "${url_name#*|}" 'var ytInitialData = '
done
capture "https://www.youtube.com/watch?v=_02K6efDLI0" \
  mkbhd-watch-json-script.html 'id="yt-initial-data"'
```

The `SOCS=CAI` cookie answers YouTube's consent prompt, so captures
from the EU and UK skip the `consent.youtube.com` redirect.

The HTML files are excluded from `oxfmt` via `.prettierignore` – they
must round-trip byte-for-byte to remain valid fixtures.
