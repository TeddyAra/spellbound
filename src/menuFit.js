import { $, onResize, isPhone } from "./dom.js";
import { onStateChange } from "./state.js";

/*
 * The left menu keeps its normal spacing whenever it fits, and only tightens
 * up (see #rollMenu.tight in style.css) when the window is too short for it.
 * How much it needs depends on the character (spell slots, death rolls), so
 * it's measured rather than set at one window height.
 */

const menu = $("rollMenu");

function fitMenu() {
    menu.classList.remove("tight");
    menu.classList.toggle("tight", !isPhone() && menu.scrollHeight > menu.clientHeight);
}

onStateChange(fitMenu);
onResize(fitMenu);

// Text size, and switching menu pages (see menuPages.js)
document.addEventListener("preferenceschange", fitMenu);
