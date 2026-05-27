// On-demand script bundled but NOT registered as a `content_scripts` manifest
// entry – injected by the popup via
// `browser.scripting.executeScript({ target, files: ['extract-channel.js'] })`.
// Filename avoids WXT's reserved `content` entrypoint type, which forces a
// manifest content-script registration with `matches`.
//
// Phase 4 implements `parseChannelInfo` (ytInitialData primary, DOM fallback)
// and returns ChannelInfo as the script's last expression.
export default defineUnlistedScript(() => {
    // Placeholder – Phase 4 replaces this with the parser call.
    return null;
});
