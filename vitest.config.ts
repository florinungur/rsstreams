import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "jsdom",
        include: ["test/**/*.test.ts", "src/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            // Per-phase scope – widened in Phase 3 (entrypoints) and Phase 4 (content).
            include: ["src/lib/**"],
            exclude: ["src/__mocks__/**", "**/*.d.ts", "**/*.test.ts"],
            thresholds: {
                lines: 100,
                branches: 100,
                functions: 100,
                statements: 100,
            },
        },
    },
});
