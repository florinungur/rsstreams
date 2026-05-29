#!/usr/bin/env node
// Check docs/amo-listing.md stays in sync with the built manifest, package.json,
// and PRIVACY.md, so the AMO listing copy never drifts from what we actually ship.
// Run before a submission:  node scripts/check-amo-listing.mjs  (or: pnpm check:listing)

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => join(root, ...parts);

const manifestPath = at(".output/firefox-mv3/manifest.json");
// The built manifest is gitignored; build it if a standalone run hasn't yet.
if (!existsSync(manifestPath)) {
    console.log("Built manifest missing – running `pnpm build`...");
    execSync("pnpm build", { cwd: root, stdio: "inherit" });
}

const listing = readFileSync(at("docs/amo-listing.md"), "utf8");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));

const passed = [];
const failed = [];
const check = (name, condition, detail) => {
    if (condition) passed.push(name);
    else failed.push(detail ? `${name} – ${detail}` : name);
};

// Pull the blockquote body under a "## <heading>..." line.
const section = (needle) => {
    const lines = listing.split("\n");
    const start = lines.findIndex((l) => l.startsWith("## ") && l.toLowerCase().includes(needle));
    if (start === -1) return null;
    const quote = [];
    for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith("> ")) quote.push(l.slice(2));
        else if (l.trim() === ">") quote.push("");
        else if (l.startsWith("## ")) break;
    }
    return quote.join("\n").trim();
};

// 1. Display name
check(
    "name matches manifest",
    listing.includes(manifest.name),
    `manifest name "${manifest.name}" not found in listing`,
);

// 2. Gecko extension ID
const geckoId = manifest.browser_specific_settings?.gecko?.id ?? "";
check(
    "gecko id matches manifest",
    Boolean(geckoId) && listing.includes(geckoId),
    `gecko id "${geckoId}" not found in listing`,
);

// 3. Data collection: none in the manifest AND stated in the listing
const required =
    manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required ?? [];
const collectsNothing = required.length === 1 && required[0] === "none";
check(
    "data collection declared none in both",
    collectsNothing && /does not collect any data/i.test(listing),
    collectsNothing
        ? 'listing missing "Does not collect any data"'
        : `manifest data_collection_permissions.required is ${JSON.stringify(required)}, expected ["none"]`,
);

// 4. Privacy policy
check("PRIVACY.md exists", existsSync(at("PRIVACY.md")));
check(
    "listing links PRIVACY.md",
    listing.includes("PRIVACY.md"),
    "listing should link to PRIVACY.md",
);

// 5. Summary length
const summary = section("summary");
check("summary section present", summary !== null);
if (summary !== null) {
    check(`summary <= 250 chars (is ${summary.length})`, summary.length <= 250);
}

// 6. Description length
const description = section("description");
check("description section present", description !== null);
if (description !== null) {
    check(`description <= 15000 chars (is ${description.length})`, description.length <= 15000);
}

// 7. Sources-zip filename carries the current package version
const zipName = `rsstreams-${pkg.version}-sources.zip`;
check(
    `sources zip name tracks version (${zipName})`,
    listing.includes(zipName),
    `listing should reference ${zipName} (package.json version is ${pkg.version})`,
);

for (const name of passed) console.log(`  ok    ${name}`);
for (const name of failed) console.error(`  FAIL  ${name}`);
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
