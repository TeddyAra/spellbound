import { beforeEach, describe, expect, it, vi } from "vitest";

/* menuPages.js finds the menu when it's loaded, so each test builds it and loads the module fresh. */
async function loadMenu() {
    document.body.innerHTML = `
        <div id="rollMenu">
            <nav id="menuTabs">
                <button data-menu-page="actions"></button>
                <button data-menu-page="saves"></button>
                <button data-menu-page="spells"></button>
            </nav>
        </div>
    `;

    vi.resetModules();

    return import("../src/menuPages.js");
}

const menu = () => document.getElementById("rollMenu");
const tab = page => document.querySelector(`[data-menu-page="${page}"]`);

beforeEach(() => localStorage.clear());

describe("menu pages", () => {
    it("starts on Actions", async () => {
        await loadMenu();

        expect(menu().dataset.page).toBe("actions");
        expect(tab("actions").classList.contains("active")).toBe(true);
        expect(tab("actions").getAttribute("aria-pressed")).toBe("true");
    });

    it("switches pages with the headers, and marks only that header", async () => {
        await loadMenu();

        tab("saves").click();

        expect(menu().dataset.page).toBe("saves");
        expect(tab("saves").classList.contains("active")).toBe(true);
        expect(tab("actions").classList.contains("active")).toBe(false);
        expect(tab("actions").getAttribute("aria-pressed")).toBe("false");
    });

    it("remembers the page", async () => {
        await loadMenu();
        tab("spells").click();

        await loadMenu();

        expect(menu().dataset.page).toBe("spells");
    });

    it("falls back to Actions for a page that doesn't exist", async () => {
        const { menuPageOrDefault } = await loadMenu();

        expect(menuPageOrDefault("folded")).toBe("actions");
        expect(menuPageOrDefault(undefined)).toBe("actions");
        expect(menuPageOrDefault("saves")).toBe("saves");
    });
});
