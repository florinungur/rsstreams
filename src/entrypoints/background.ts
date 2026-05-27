// Minimal background entrypoint. MV3 action icon is permanent on the toolbar;
// no tab-tracking is required (unlike upstream's page-action approach).
export default defineBackground(() => {
    // Intentionally empty for Phase 1. Hooks for runtime.onInstalled etc. land later.
});
