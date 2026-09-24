import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Kept apart from vitest.config.ts so the live-network canary never runs in
// the unit suite.

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            "@/": `${srcDir}/`,
            "~/": `${srcDir}/`,
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        include: ["test/selector-canary.ts"],
        // Must exceed the canary's worst-case retry time (see fetchYouTube), or a
        // stall that should skip fails instead.
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
});
