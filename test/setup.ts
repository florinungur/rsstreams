// Stub for the WXT build-time global, so the entrypoint imports under jsdom. It
// hands back the entrypoint's main function.

(
    globalThis as unknown as { defineUnlistedScript: (definition: { main: unknown }) => unknown }
).defineUnlistedScript = (definition) => definition.main;
