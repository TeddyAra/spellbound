import { $, hide } from "./dom.js";

/*
 * Overlays that close when clicking the backdrop or pressing Escape. The two
 * result windows aren't among them, so a stray click can't lose a roll: they
 * only close with their own buttons.
 */
const closableOverlays = [
    "characterOverlay",
    "charactersOverlay",
    "featuresOverlay",
    "hpManagerOverlay",
    "constructOverlay",
    "modulesOverlay",
    "referenceOverlay",
    "glossaryOverlay",
    "rollSetupOverlay",
    "saveSpellOverlay",
    "tileCountOverlay",
    "tileMenuOverlay",
    "rollDiceOverlay",
    "inventoryOverlay",
    "notesOverlay",
    "logOverlay",
    "settingsOverlay",
    "changelogOverlay"
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
