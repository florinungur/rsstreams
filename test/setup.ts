// Vitest setup: register the WXT auto-imports as identity functions so the
// entrypoint modules (`background.ts`, `extract-channel.ts`) can be imported
// in unit tests under jsdom without a real WXT runtime.
//
// `defineBackground(fn)` and `defineUnlistedScript(fn)` are normally injected
// by WXT at build time. Their runtime contract is "return the spec / function
// unchanged so the bundler can wire it in" – an identity function matches the
// contract for test purposes.

(globalThis as unknown as { defineBackground: (fn: unknown) => unknown }).defineBackground = (fn) =>
    fn;

(globalThis as unknown as { defineUnlistedScript: (fn: unknown) => unknown }).defineUnlistedScript =
    (fn) => fn;
