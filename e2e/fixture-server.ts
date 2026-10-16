// Serves the unit-test fixtures on 127.0.0.1 at the YouTube paths the
// injected script requests.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

/** MKBHD – the channel every fixture but the collab video resolves to. */
export const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

/** A FailArmy video credited to four collaborating channels. */
export const COLLAB_VIDEO_ID = "TzMAPc4ucKQ";

function fixture(name: string): Buffer {
    return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)));
}

// Keyed by path, or by path plus `v` where one path serves several videos.
const ROUTES: Record<string, string> = {
    [`/channel/${CHANNEL_ID}`]: "mkbhd-channel-id.html",
    [`/channel/${CHANNEL_ID}/playlists`]: "mkbhd-playlists-tab.html",
    [`/watch?v=${COLLAB_VIDEO_ID}`]: "collab-watch.html",
    "/watch": "mkbhd-watch.html",
    "/playlist": "mkbhd-playlist.html",
};

export interface FixtureServer {
    /** Origin to navigate to, e.g. `http://127.0.0.1:54321`. */
    origin: string;
    close: () => Promise<void>;
}

/** Start the fixture server on a random free port bound to 127.0.0.1. */
export function startFixtureServer(): Promise<FixtureServer> {
    const server = createServer((req, res) => {
        const { pathname, searchParams } = new URL(req.url ?? "/", "http://127.0.0.1");
        // Only `v` picks a video: YouTube's own scripts in the fixtures reload
        // the page with extra params such as `themeRefresh=1`.
        const video = searchParams.get("v");
        const file = (video !== null && ROUTES[`${pathname}?v=${video}`]) || ROUTES[pathname];
        if (file) {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(fixture(file));
            return;
        }
        if (pathname === "/") {
            // Bootstrap page: the suite navigates here first so the content tab
            // has a 127.0.0.1 URL that `tabs.query` can match before any fixture
            // is loaded.
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(
                "<!doctype html><html><head><title>fixtures</title></head><body>ok</body></html>",
            );
            return;
        }
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
    });

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;
            resolve({
                origin: `http://127.0.0.1:${port}`,
                close: () => new Promise<void>((done) => server.close(() => done())),
            });
        });
    });
}
