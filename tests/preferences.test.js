import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* preferences.js reads the system setting when it's loaded, so each test loads it fresh. */
async function loadPreferences(reducedMotion) {
    vi.resetModules();
    vi.stubGlobal("matchMedia", query => ({ matches: reducedMotion && query.includes("reduce") }));

    return import("../src/preferences.js");
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("dice animation", () => {
    it("is on by default", async () => {
        const { preference } = await loadPreferences(false);

        expect(preference("diceAnimation")).toBe("full");
    });

    it("defaults to off when the system asks for reduced motion", async () => {
        const { preference } = await loadPreferences(true);

        expect(preference("diceAnimation")).toBe("off");
    });

    it("lets the player turn it on anyway, and remembers that", async () => {
        const { setPreference } = await loadPreferences(true);

        setPreference("diceAnimation", "full");

        const { preference } = await loadPreferences(true);

        expect(preference("diceAnimation")).toBe("full");
    });

    it("keeps following the system after another setting changes", async () => {
        const { setPreference } = await loadPreferences(false);

        setPreference("tileSize", "large");

        const { preference } = await loadPreferences(true);

        expect(preference("diceAnimation")).toBe("off");
        expect(preference("tileSize")).toBe("large");
    });
});
