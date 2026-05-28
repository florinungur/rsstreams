// Selenium driver setup for the E2E suite. Drives stock Firefox via the
// classic `installAddon` path (WebDriver BiDi `webExtension.install` is not yet
// implemented in selenium-webdriver's Node binding as of 4.44.0 – see the
// Phase 5 notes). Selenium Manager auto-resolves a geckodriver matching the
// installed Firefox, so no `geckodriver` npm dependency is needed.

import { existsSync } from "node:fs";
import { env, platform } from "node:process";
import { fileURLToPath } from "node:url";
import { Builder } from "selenium-webdriver";
import * as firefox from "selenium-webdriver/firefox.js";

export const GECKO_ID = "rsstreams@florinungur.com";

// Fixed UUID seeded into `extensions.webextensions.uuids` so the popup is
// reachable at a predictable `moz-extension://` origin (the toolbar click that
// opens a real popup can't be automated in stock Firefox).
export const FIXED_UUID = "d4f9a0e2-1b3c-4d5e-6f70-8192a3b4c5d6";

// The `--mode e2e` build (widened host_permissions); see wxt.config.ts.
export const E2E_EXTENSION = fileURLToPath(new URL("../.output/firefox-mv3-e2e", import.meta.url));

const MAC_FIREFOX = "/Applications/Firefox.app/Contents/MacOS/firefox";

export function popupUrl(search = ""): string {
    return `moz-extension://${FIXED_UUID}/popup.html${search}`;
}

export async function buildDriver(): Promise<firefox.Driver> {
    const options = new firefox.Options();

    // Locate Firefox: explicit override, else the macOS app bundle, else leave
    // it to Selenium Manager / PATH (CI installs Firefox via setup-firefox).
    if (env["FIREFOX_BINARY"]) {
        options.setBinary(env["FIREFOX_BINARY"]);
    } else if (platform === "darwin" && existsSync(MAC_FIREFOX)) {
        options.setBinary(MAC_FIREFOX);
    }

    options.setPreference(
        "extensions.webextensions.uuids",
        JSON.stringify({ [GECKO_ID]: FIXED_UUID }),
    );

    // Test-only clipboard access. The production manifest stays `clipboardWrite`
    // only; these prefs let the suite read back what a Copy button wrote without
    // granting end users a `clipboardRead` permission.
    options.setPreference("dom.events.testing.asyncClipboard", true);
    options.setPreference("permissions.default.clipboard-read", 1);
    options.setPreference("permissions.default.clipboard-write", 1);

    // Headless by default; set HEADED=1 to watch the run locally.
    if (env["HEADED"] !== "1") {
        options.addArguments("-headless");
    }

    const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).build();
    return driver as firefox.Driver;
}
