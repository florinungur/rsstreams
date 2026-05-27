// Smoke tests that exercise the entrypoint shells (`background.ts` and
// `extract-channel.ts`) so the v8 coverage provider records 100% on them.
// Both files are thin wrappers over WXT auto-globals registered in
// `test/setup.ts`; this module just imports + invokes them once.

import { describe, expect, it } from "vitest";

describe("entrypoint shells", () => {
    it("background.ts is a no-op spec function", async () => {
        const mod = await import("@/entrypoints/background");
        const spec = mod.default as unknown as () => void;
        expect(typeof spec).toBe("function");
        expect(spec()).toBeUndefined();
    });

    it("extract-channel.ts returns null when ytInitialData and microdata are absent", async () => {
        const mod = await import("@/entrypoints/extract-channel");
        const spec = mod.default as unknown as () => unknown;
        expect(typeof spec).toBe("function");
        // jsdom's default document has no microdata; ytInitialData is undefined
        // on window. parseChannelInfo returns null for that combination.
        expect(spec()).toBeNull();
    });
});
