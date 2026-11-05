import { $, onResize } from "./dom.js";
import { onStateChange } from "./state.js";
import { preference, setPreference } from "./preferences.js";
import { nearestPage, relocate } from "./phoneLayout.js";
import { addPullToReload } from "./pullToReload.js";

/*
 * The phone layout: a top bar that's always there, and below it one page for
 * each part of the dashboard, reached by swiping or with the tabs. The tiles
 * are a view of their own (see tileView.js).
 *
 * It uses the desktop's own panels, moved into place, so everything on them
 * keeps working the same. Swiping is the browser's own scrolling, snapping to
 * each page (see the PHONE section of style.css).
 */

const root = document.documentElement;
const pagesBox = $("phonePages");
const tabsBox = $("phoneTabs");
const tabs = [...tabsBox.querySelectorAll("button")];

const modalOf = overlay => $(overlay).querySelector(".modal");
const page = id => $(`phonePage-${id}`);

/* What goes where. In this order, so that a later one can go inside an earlier one. */
const PLACES = () => [
    [$("characterHeader"), $("phoneHeaderTop")],
    [$("settingsButton"), $("phoneHeaderTop")],
    [$("statGrid"), $("phoneHeader")],
    [$("phoneRests"), $("statGrid")],
    [$("shortRestButton"), $("phoneRests")],
    [$("longRestButton"), $("phoneRests")],
    [$("rollMenu"), page("actions")],
    [$("savedSpells"), page("spells")],
    [$("constructPanel"), page("construct")],
    [$("diceGrid"), page("dice")],
    [modalOf("inventoryOverlay"), page("inventory")],
    [modalOf("notesOverlay"), page("notes")],
    [modalOf("featuresOverlay"), page("features")],
    [modalOf("referenceOverlay"), page("reference")],
    [modalOf("characterOverlay"), page("character")],

    // Under the pages or the tile view, which make room for it
    [$("actionPanel"), $("phoneShell")]
];

let putBack = [];

function enterPhoneLayout() {
    putBack = PLACES().map(([node, target]) => relocate(node, target));
}

function leavePhoneLayout() {
    putBack.reverse().forEach(restore => restore());
    putBack = [];
}

/*
 * =========================================================
 * PAGES AND TABS
 * =========================================================
 */

let current = preference("phonePage");
let downed = false;
let saveTimer = null;

// Whether the pages have been scrolled to the current one yet
let placed = false;

const visiblePages = () => [...pagesBox.children].filter(section => !section.classList.contains("hidden"));

function markTab() {
    for (const tab of tabs) {
        const active = tab.dataset.page === current;

        tab.classList.toggle("active", active);

        if (active) {
            tab.setAttribute("aria-current", "page");

            // Keeps the active tab in the middle of the strip, if the strip scrolls
            tabsBox.scrollTo({
                left: tab.offsetLeft - (tabsBox.clientWidth - tab.offsetWidth) / 2,
                behavior: placed ? "smooth" : "instant"
            });
        } else {
            tab.removeAttribute("aria-current");
        }
    }
}

function setCurrent(id) {
    if (id === current) {
        return;
    }

    current = id;
    markTab();

    // Once the page has settled, so a swipe isn't interrupted by saving
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setPreference("phonePage", current), 300);
}

function goTo(id) {
    const pages = visiblePages();
    const index = Math.max(0, pages.findIndex(section => section.dataset.page === id));

    pagesBox.scrollTo({ left: index * pagesBox.clientWidth, behavior: "instant" });

    setCurrent(pages[index]?.dataset.page ?? id);
    markTab();
}

/* Straight to the page, with a quick fade. Sliding there would drag every page in between past. */
for (const tab of tabs) {
    tab.addEventListener("click", () => {
        if (tab.dataset.page === current) {
            return;
        }

        goTo(tab.dataset.page);

        page(tab.dataset.page).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
    });
}

pagesBox.addEventListener("scroll", () => {
    const pages = visiblePages();
    const index = nearestPage(pagesBox.scrollLeft, pagesBox.clientWidth, pages.length);

    if (pages[index]) {
        setCurrent(pages[index].dataset.page);
    }
}, { passive: true });

/* Only characters with a construct get its page, and falling to 0 HP brings up the death rolls. */
function syncPages() {
    if (!root.classList.contains("phone")) {
        return;
    }

    const hadConstruct = !page("construct").classList.contains("hidden");
    const hasConstruct = !$("constructPanel").classList.contains("hidden");

    page("construct").classList.toggle("hidden", !hasConstruct);
    $("constructTab").classList.toggle("hidden", !hasConstruct);

    const isDowned = $("rollMenu").classList.contains("downed");
    const justDowned = isDowned && !downed;

    downed = isDowned;

    // Otherwise left alone, so a change can't interrupt a swipe
    if (justDowned) {
        goTo("actions");
    } else if (!placed || hadConstruct !== hasConstruct) {
        goTo(current);
    }

    placed = true;
}

onStateChange(syncPages);

onResize(() => {
    if (root.classList.contains("phone")) {
        goTo(current);
    }
});

/*
 * =========================================================
 * SWITCHING BETWEEN LAYOUTS
 * =========================================================
 *
 * The inline script in index.html sets the first one, before anything is drawn.
 * After that it can change with the size of a desktop browser window.
 */

addPullToReload($("phoneHeader"));
addPullToReload($("tileViewHeader"));

const phoneQuery = window.matchMedia(window.PHONE_QUERY);

const inPhoneLayout = () => putBack.length > 0;

phoneQuery.addEventListener("change", ({ matches }) => {
    root.classList.toggle("phone", matches);

    // The window can change size while the page loads, so this can already be the right layout
    if (matches === inPhoneLayout()) {
        return;
    }

    if (matches) {
        placed = false;
        enterPhoneLayout();
    } else {
        leavePhoneLayout();
    }

    // The features page is only drawn when it can be seen, and the menu measures itself
    document.dispatchEvent(new Event("statechange"));
});

root.classList.toggle("phone", phoneQuery.matches);

if (phoneQuery.matches) {
    enterPhoneLayout();
}
