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
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
});
