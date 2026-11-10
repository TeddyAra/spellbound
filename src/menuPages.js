import { $ } from "./dom.js";
import { preference, setPreference } from "./preferences.js";

/*
 * The menu's three pages under the general info: Actions, Saves & senses and
 * Saved spells, picked with the headers above them. The stylesheet shows the
 * one named on the menu's data-page (see MENU PAGES in style.css).
 *
 * The phone has no headers: the actions stay on its Actions page and the
 * other two move to pages of their own (see phone.js).
 */

export const MENU_PAGES = ["actions", "saves", "spells"];

/* The page to show: the one remembered, or Actions if that's no page (any more). */
export const menuPageOrDefault = page => MENU_PAGES.includes(page) ? page : MENU_PAGES[0];

const menu = $("rollMenu");
const tabs = [...$("menuTabs").querySelectorAll("button")];

function render() {
    const current = menuPageOrDefault(preference("menuPage"));

    menu.dataset.page = current;

    for (const tab of tabs) {
        const active = tab.dataset.menuPage === current;

        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
    }
}

for (const tab of tabs) {
    // Remembering it redraws the menu and makes it fit again (see menuFit.js)
    tab.addEventListener("click", () => setPreference("menuPage", tab.dataset.menuPage));
}

document.addEventListener("preferenceschange", render);
render();
