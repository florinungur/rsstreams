// Stubs for the WXT build-time globals, so entrypoints import under jsdom. Each
// hands back the entrypoint's main function.

(globalThis as unknown as { defineBackground: (fn: unknown) => unknown }).defineBackground = (fn) =>
    fn;

(
    globalThis as unknown as { defineUnlistedScript: (definition: { main: unknown }) => unknown }
).defineUnlistedScript = (definition) => definition.main;
