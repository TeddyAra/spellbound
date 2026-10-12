/*
 * Preferences for this browser (not the character), changed in the Settings
 * window (see settings.js). The ones that change how the page looks are put
 * on <html> as data attributes; index.html does that before the page draws
 * too, so nothing jumps on load. The theme has its own key (see settings.js).
 */

export const PREFERENCES_KEY = "spellboundPreferences";

export const DEFAULT_PREFERENCES = {
    // "full", "fast" or "off" (results appear straight away)
    diceAnimation: "full",

    // Fill in the DC from the last roll
    rememberDC: false,
    lastDC: "",

    // "small", "normal" or "large"
    tileSize: "normal",
    letterScores: true,
    wordUnderlines: true,

    confirmLongRest: true,
    confirmClearBoard: true,

    // "small", "normal" or "large"
    textSize: "normal",

    // Folded open in the menu: a Runesmith's construct (see construct.js), and the saved spells (see spellSlots.js)
    constructOpen: true,
    savedSpellsOpen: true
};

let preferences = load();

function load() {
    try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY)) };
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
}

export const preference = key => preferences[key];

export function setPreference(key, value) {
    preferences = { ...preferences, [key]: value };

    try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
        // Not remembered, but still used for now
    }

    applyPreferences();
}

/* The data attributes the stylesheet uses (see the PREFERENCES section of style.css). */
export function applyPreferences() {
    const root = document.documentElement.dataset;

    root.tileSize = preferences.tileSize;
    root.textSize = preferences.textSize;
    root.letterScores = preferences.letterScores ? "on" : "off";
    root.wordUnderlines = preferences.wordUnderlines ? "on" : "off";

    document.dispatchEvent(new Event("preferenceschange"));
}

applyPreferences();
