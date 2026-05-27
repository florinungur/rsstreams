import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: "src",
    manifestVersion: 3,
    manifest: {
        name: "RSStreams for YouTube",
        description: "Find every RSS/Atom feed for the YouTube page you're on.",
        permissions: ["scripting", "clipboardWrite"],
        host_permissions: ["https://www.youtube.com/*"],
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
    },
});
