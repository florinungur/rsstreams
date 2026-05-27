import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror the `@/` and `~/` aliases that WXT generates in `.wxt/tsconfig.json`
// so vitest resolves them the same way the production build does.
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
        include: ["test/**/*.test.ts", "src/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            // Phase 4 widening: added `src/entrypoints/extract-channel.ts` and
            // `src/entrypoints/background.ts`. Both are thin shells over WXT
            // auto-globals; the `entrypoints-smoke` test imports + invokes them.
            include: [
                "src/lib/**",
                "src/entrypoints/popup/**",
                "src/entrypoints/extract-channel.ts",
                "src/entrypoints/background.ts",
                "src/ui/**",
            ],
            exclude: [
                "src/__mocks__/**",
                "**/*.d.ts",
                "**/*.test.ts",
                // Non-TS assets; the v8 provider would try to parse them otherwise.
                "**/*.html",
                "**/*.css",
            ],
            thresholds: {
                lines: 100,
                branches: 100,
                functions: 100,
                statements: 100,
            },
        },
    },
});
