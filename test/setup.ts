// Stub for the WXT build-time global, so the entrypoint imports under jsdom. It
// hands back the definition, as WXT's own does.

Object.assign(globalThis, { defineUnlistedScript: (definition: unknown) => definition });
