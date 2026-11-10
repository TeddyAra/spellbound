/*
 * Preferences for this browser (not the character), changed in the Settings
 * window (see settings.js). The ones that change how the page looks are put
 * on <html> as data attributes; index.html does that before the page draws
 * too, so nothing jumps on load. The theme has its own key (see settings.js).
 */

export const PREFERENCES_KEY = "spellboundPreferences";

/* The system's "reduce motion" setting: no flying dice unless the player asks for them. */
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export const DEFAULT_PREFERENCES = {
    // "full", "fast" or "off" (results appear straight away)
    diceAnimation: prefersReducedMotion() ? "off" : "full",

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

    // Folded open next to the menu: a Golemwright's construct (see construct.js)
    constructOpen: true,

    // The page showing under the menu's general info (see menuPages.js), and in the phone layout (see phone.js)
    menuPage: "actions",
    phonePage: "actions",

    // The rules search (see rulesSearch.js): whether it searches the DM chapters too,
    // and how often each section was opened, for the suggestions ({ id: count })
    rulesSearchDM: false,
    rulesSearchHistory: {}
};

// Only what the player changed, so the rest keeps following the defaults
let changed = load();
let preferences = { ...DEFAULT_PREFERENCES, ...changed };

function load() {
    try {
        return JSON.parse(localStorage.getItem(PREFERENCES_KEY)) ?? {};
    } catch {
        return {};
    }
}

export const preference = key => preferences[key];

export function setPreference(key, value) {
    changed = { ...changed, [key]: value };
    preferences = { ...DEFAULT_PREFERENCES, ...changed };

    try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(changed));
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
