import { vi } from "vitest";

export interface MockBrowser {
    tabs: {
        query: ReturnType<typeof vi.fn>;
    };
    scripting: {
        executeScript: ReturnType<typeof vi.fn>;
    };
    runtime: {
        getManifest: ReturnType<typeof vi.fn>;
    };
}

/**
 * Install a fresh `browser.*` mock on `globalThis` and return the spy handles.
 * Pair with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function installBrowserMock(): MockBrowser {
    const mock: MockBrowser = {
        tabs: { query: vi.fn() },
        scripting: { executeScript: vi.fn() },
        runtime: { getManifest: vi.fn() },
    };
    vi.stubGlobal("browser", mock);
    return mock;
}
