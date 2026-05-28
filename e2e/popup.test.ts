// End-to-end suite: install the built extension in stock Firefox, drive the
// real popup against locally-served YouTube fixtures, and assert it renders the
// expected feed rows and copies the right URL to the clipboard.
//
// The popup can't be opened via a toolbar click in automated Firefox, so we
// navigate directly to `moz-extension://<fixed-uuid>/popup.html` (the UUID is
// pinned via a profile pref) and pass `?tabId=<content tab>` so the popup
// injects `extract-channel.js` into the fixture tab instead of itself.

import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { By, until } from "selenium-webdriver";
import { buildDriver, E2E_EXTENSION, popupUrl } from "./driver.ts";
import { CHANNEL_ID, startFixtureServer, type FixtureServer } from "./fixture-server.ts";

const RENDER_TIMEOUT = 15_000;
const UPLOADS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const LONG_FORM_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${CHANNEL_ID.slice(2)}`;

describe("RSStreams popup (E2E, stock Firefox)", () => {
    let server: FixtureServer;
    let driver: Awaited<ReturnType<typeof buildDriver>>;
    let contentHandle: string;
    let popupHandle: string;
    let contentTabId: number;

    before(async () => {
        server = await startFixtureServer();
        driver = await buildDriver();
        await driver.installAddon(E2E_EXTENSION, true);

        // Tab 0 is the content tab (the page the user is "on").
        contentHandle = await driver.getWindowHandle();
        await driver.get(`${server.origin}/`);

        // Tab 1 hosts the popup. Open it once (no param) to discover the
        // content tab's WebExtension id via the extension's own tabs API –
        // WebDriver window handles aren't WebExtension tab ids.
        await driver.switchTo().newWindow("tab");
        popupHandle = await driver.getWindowHandle();
        await driver.get(popupUrl());

        const discovered = await driver.executeAsyncScript<number | null>(
            `const cb = arguments[arguments.length - 1];
             browser.tabs.query({ url: "http://127.0.0.1/*" })
               .then((tabs) => cb(tabs.length ? tabs[0].id : null))
               .catch(() => cb(null));`,
        );
        assert.equal(typeof discovered, "number", "should discover the content tab id");
        contentTabId = discovered as number;
    });

    after(async () => {
        await driver?.quit();
        await server?.close();
    });

    /** Point the content tab at a fixture path, then (re)load the popup against it. */
    async function renderPopupFor(path: string): Promise<void> {
        await driver.switchTo().window(contentHandle);
        await driver.get(`${server.origin}${path}`);

        await driver.switchTo().window(popupHandle);
        await driver.get(popupUrl(`?tabId=${contentTabId}`));
        await driver.wait(
            until.elementLocated(By.css(".feed-list__group, .feed-list__empty")),
            RENDER_TIMEOUT,
        );
    }

    async function countRows(selector: string): Promise<number> {
        return (await driver.findElements(By.css(selector))).length;
    }

    async function urlOf(rowVariant: string): Promise<string> {
        const el = await driver.findElement(By.css(`.feed-row--${rowVariant} .feed-row__url`));
        return (await el.getText()).trim();
    }

    it("renders 4 system rows + playlists on a channel page", async () => {
        await renderPopupFor(`/channel/${CHANNEL_ID}`);

        assert.equal(await countRows(".feed-row--uploads"), 1, "uploads row");
        assert.equal(await countRows(".feed-row--long-form"), 1, "long-form row");
        assert.equal(await countRows(".feed-row--shorts"), 1, "shorts row");
        assert.equal(await countRows(".feed-row--live"), 1, "live row");

        assert.equal(await urlOf("uploads"), UPLOADS_URL);
        assert.equal(await urlOf("long-form"), LONG_FORM_URL);

        const playlistRows = await countRows(".feed-row--playlist");
        assert.ok(playlistRows >= 1, `expected >=1 playlist row, got ${playlistRows}`);

        // getText() returns the CSS text-transform'd label (uppercased), so
        // match case-insensitively – we care about the "Playlists (N)" shape.
        const summary = await driver.findElement(By.css(".feed-list__playlists summary")).getText();
        assert.match(summary, /^playlists \(\d+\)$/i);
    });

    it("copies the long-form feed URL to the clipboard", async () => {
        await renderPopupFor(`/channel/${CHANNEL_ID}`);

        const button = await driver.findElement(By.css(".feed-row--long-form .feed-row__copy"));
        await button.click();
        await driver.wait(async () => (await button.getText()) === "Copied", RENDER_TIMEOUT);

        const clip = await driver.executeAsyncScript<string>(
            `const cb = arguments[arguments.length - 1];
             navigator.clipboard.readText().then((t) => cb(t)).catch((e) => cb("CLIP-ERR:" + e));`,
        );
        assert.equal(clip, LONG_FORM_URL);
    });

    it("resolves the channel from a watch page", async () => {
        await renderPopupFor("/watch?v=_02K6efDLI0");

        assert.equal(await countRows(".feed-row--uploads"), 1);
        assert.equal(await urlOf("uploads"), UPLOADS_URL);
    });

    it("resolves the channel from a playlist page", async () => {
        await renderPopupFor("/playlist?list=PLBsP89CPrMeM2MmF4suOeT0vsic9nEC2Y");

        assert.equal(await countRows(".feed-row--uploads"), 1);
        assert.equal(await urlOf("uploads"), UPLOADS_URL);
    });
});
