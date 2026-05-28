// Serves the captured YouTube HTML fixtures over HTTP on 127.0.0.1 so the
// Selenium E2E suite can drive a real `extract-channel.js` injection without
// hitting live YouTube. Routes mirror the YouTube URL shapes the content
// script touches:
//   - the channel / watch / playlist page the user is "on", and
//   - the `/channel/<id>/playlists` tab the script fetches to pull the
//     canonical playlist grid.
// Same fixtures the unit tests use; see test/fixtures/README.md.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

/** MKBHD – the channel all fixtures resolve to. */
export const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

function fixture(name: string): Buffer {
    return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)));
}

const ROUTES: Record<string, string> = {
    [`/channel/${CHANNEL_ID}`]: "mkbhd-channel-id.html",
    [`/channel/${CHANNEL_ID}/playlists`]: "mkbhd-playlists-tab.html",
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
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        const file = ROUTES[pathname];
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
