import { $, hide } from "./dom.js";

/* Overlays that close when clicking the backdrop or pressing Escape. */
const closableOverlays = [
    "characterOverlay",
    "featuresOverlay",
    "hpManagerOverlay",
    "constructOverlay",
    "referenceOverlay",
    "glossaryOverlay",
    "rollSetupOverlay",
    "rollResultOverlay",
    "saveSpellOverlay",
    "tileCountOverlay",
    "rollDiceOverlay",
    "inventoryOverlay",
    "infoResultOverlay",
    "settingsOverlay"
].map($);

for (const overlay of closableOverlays) {
    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            hide(overlay);
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closableOverlays.forEach(hide);
    }
});
