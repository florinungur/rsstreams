// On-demand script bundled but NOT registered as a `content_scripts` manifest
// entry – injected by the popup via
// `browser.scripting.executeScript({ target, files: ['extract-channel.js'] })`.
// Filename avoids WXT's reserved `content` entrypoint type, which forces a
// manifest content-script registration with `matches`.
//
// The script is a thin shell over `parseChannelInfo`: read `window.ytInitialData`
// (YouTube keeps it current across SPA navigation) and pass the live document
// as the DOM fallback source. `defineUnlistedScript`'s function return value
// becomes the script's last expression, which `executeScript` surfaces on
// `InjectionResult.result`.

import { parseChannelInfo } from "@/lib/parse-channel-info";

declare global {
    interface Window {
        ytInitialData?: unknown;
    }
}

export default defineUnlistedScript(() => {
    return parseChannelInfo({
        ytInitialData: window.ytInitialData,
        document,
    });
});
