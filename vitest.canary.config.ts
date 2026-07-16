import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone config for the nightly selector canary. Runs `test/selector-canary.ts`
// only – a live-network probe that re-fetches YouTube and asserts the selector
// chain + ytInitialData parser still resolve a channel. Deliberately separate
// from `vitest.config.ts` so the canary never runs in the unit suite / coverage
// gate (it hits the network and would make CI flaky).

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
        // Worst case per test: 4 fetch attempts × 20s AbortSignal timeout
        // + ~7s cumulative backoff ≈ 87s. 30s couldn't fit even two timed-out
        // attempts, turning the skip-class timeout into a test failure.
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
});
