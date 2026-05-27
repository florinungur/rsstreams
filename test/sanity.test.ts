import { describe, it, expect } from "vitest";

// Phase 1 placeholder – proves the vitest pipeline runs end to end.
// Phase 2 replaces this with real coverage of `src/lib/*`.
describe("toolchain sanity", () => {
    it("runs vitest under jsdom", () => {
        expect(typeof document).toBe("object");
    });
});
