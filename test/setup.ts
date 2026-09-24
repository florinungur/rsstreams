// Identity stubs for the WXT build-time globals, so entrypoints import under jsdom.

(globalThis as unknown as { defineBackground: (fn: unknown) => unknown }).defineBackground = (fn) =>
    fn;

(globalThis as unknown as { defineUnlistedScript: (fn: unknown) => unknown }).defineUnlistedScript =
    (fn) => fn;
