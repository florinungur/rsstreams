import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: "src",
    manifestVersion: 3,
    manifest: ({ mode }) => ({
        name: "RSStreams for YouTube",
        description: "Find every RSS/Atom feed for the YouTube page you're on.",
        permissions: ["scripting", "clipboardWrite"],
        // Production ships youtube.com only. `wxt build --mode e2e` additionally
        // grants 127.0.0.1 so the Selenium suite can inject `extract-channel.js`
        // into a locally-served fixture page (executeScript needs a host-permission
        // match). The widened build lands in `.output/firefox-mv3-e2e/` and is
        // for tests only – never submitted to AMO. The Phase 6 release build runs
        // the default (production) mode and stays youtube.com-only.
        host_permissions:
            mode === "e2e"
                ? ["https://www.youtube.com/*", "http://127.0.0.1/*"]
                : ["https://www.youtube.com/*"],
        browser_specific_settings: {
            gecko: {
                id: "rsstreams@florinungur.com",
                // Firefox 142 is the floor across desktop and Android that
                // supports `data_collection_permissions` (added 2025-11).
                strict_min_version: "142.0",
                // Required for new AMO submissions since 2025-11-03. No data
                // leaves the browser; declare explicitly.
                data_collection_permissions: {
                    required: ["none"],
                },
            },
        },
        action: {
            default_title: "Show feeds for this page",
        },
    }),
    // The AMO source submission (`wxt zip`) excludes node_modules, dotfiles, and
    // .output by default. `coverage/` is generated test output and isn't needed
    // to reproduce the build – keep it out of the sources zip.
    zip: {
        excludeSources: ["coverage/**"],
    },
});
