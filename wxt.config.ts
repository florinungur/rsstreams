import { defineConfig } from "wxt";

export default defineConfig({
    srcDir: "src",
    manifestVersion: 3,
    manifest: ({ mode }) => ({
        name: "RSStreams for YouTube",
        description: "Find every RSS/Atom feed for the YouTube page you're on.",
        permissions: ["scripting", "clipboardWrite"],
        // The e2e mode adds 127.0.0.1 so the Selenium suite can inject into
        // local fixtures; release builds never use it.
        host_permissions:
            mode === "e2e"
                ? ["https://www.youtube.com/*", "http://127.0.0.1/*"]
                : ["https://www.youtube.com/*"],
        browser_specific_settings: {
            gecko: {
                id: "rsstreams@florinungur.com",
                // The lowest version with `data_collection_permissions` on
                // both desktop and Android.
                strict_min_version: "142.0",
                // AMO requires this for new submissions.
                data_collection_permissions: {
                    required: ["none"],
                },
            },
        },
        action: {
            default_title: "Show feeds for this page",
        },
    }),
    zip: {
        excludeSources: ["coverage/**", "docs/screenshots/**"],
    },
});
