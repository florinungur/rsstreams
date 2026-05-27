// On-demand script bundled but NOT registered as a `content_scripts` manifest
// entry – injected by the popup via
// `browser.scripting.executeScript({ target, files: ['extract-channel.js'] })`.
// Filename avoids WXT's reserved `content` entrypoint type, which forces a
// manifest content-script registration with `matches`.
//
// The script is a thin shell over `parseChannelInfo`. ytInitialData comes from
// three sources in order:
//   1. `window.ytInitialData` – works in `world: "MAIN"`; in the default
//      isolated content-script world this is usually undefined.
//   2. `window.wrappedJSObject.ytInitialData` – Firefox-specific bridge from
//      the isolated world into the page's main JS object graph.
//   3. The inline `<script>var ytInitialData = {…};</script>` block parsed
//      via `extractYtInitialData(document)` – reliable from any world that
//      can read the DOM.
// `defineUnlistedScript`'s function return value becomes the script's last
// expression, which `executeScript` surfaces on `InjectionResult.result`.

import { extractYtInitialData, parseChannelInfo } from "@/lib/parse-channel-info";

declare global {
    interface Window {
        ytInitialData?: unknown;
        wrappedJSObject?: { ytInitialData?: unknown };
    }
}

export default defineUnlistedScript(() => {
    const ytInitialData =
        window.ytInitialData ??
        window.wrappedJSObject?.ytInitialData ??
        extractYtInitialData(document);
    return parseChannelInfo({ ytInitialData, document });
});
