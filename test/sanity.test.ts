import { describe, it, expect } from "vitest";

// Smoke check that the vitest pipeline runs end to end under jsdom.
// Real coverage lives in `src/lib/*` and `src/entrypoints/**`.
describe("toolchain sanity", () => {
    it("runs vitest under jsdom", () => {
        expect(typeof document).toBe("object");
    });
});
