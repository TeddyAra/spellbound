import { $, show, hide, element } from "./dom.js";
import { preference, setPreference } from "./preferences.js";
import { closeColorPicker } from "./colorPicker.js";
import { renderDiceSettings } from "./diceSettings.js";

/*
 * The Settings window: preferences for this browser (see preferences.js).
 * The dice colours are in diceSettings.js.
 *
 * The theme sets data-theme on <html> (see the themes in style.css). The page
 * also sets it before drawing, from the same storage key, so the default
 * doesn't flash first (see index.html).
 */

const THEME_KEY = "spellboundTheme";

// Theme key → name, a short description, and swatches for its preview
const THEMES = {
    beyond: {
        name: "Dark",
        description: "Dark slate and blue",
        swatches: ["#1d2229", "#3d4855", "#1b9af7", "#e40712"]
    },
    crimson: {
        name: "Light",
        description: "White sheets in crimson frames",
        swatches: ["#262626", "#ffffff", "#c53131", "#e3e7eb"]
    }
};

const settingsOverlay = $("settingsOverlay");

/* index.html has already worked this out from the saved choice, retired themes included. */
function savedTheme() {
    return document.documentElement.dataset.theme;
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

function setTheme(theme) {
    applyTheme(theme);

    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        // Not remembered, but still switched for now
    }

    renderThemeOptions();
}

function renderThemeOptions() {
    const current = savedTheme();

    $("themeOptions").replaceChildren(...Object.entries(THEMES).map(([key, theme]) => {
        const option = element("button", "theme-option");
        const swatches = element("span", "theme-swatches");

        option.type = "button";
        option.classList.toggle("selected", key === current);
        option.setAttribute("aria-pressed", String(key === current));

        for (const colour of theme.swatches) {
            const swatch = element("span", "theme-swatch");

            swatch.style.background = colour;
            swatches.append(swatch);
        }

        option.append(
            swatches,
            element("strong", null, theme.name),
            element("span", "result-label", theme.description)
        );

        option.addEventListener("click", () => setTheme(key));

        return option;
    }));
}

/*
 * =========================================================
 * PREFERENCES
 * =========================================================
 *
 * Controls marked with data-preference: a row of buttons (one per
 * data-value) or a checkbox. See preferences.js.
 */

const preferenceControls = settingsOverlay.querySelectorAll("[data-preference]");

function renderPreferences() {
    // No dice to show when the animation is off
    const animationOff = preference("diceAnimation") === "off";

    $("testDiceButton").disabled = animationOff;
    $("testDiceButton").title = animationOff ? "Dice animation is off" : "";

    for (const control of preferenceControls) {
        const value = preference(control.dataset.preference);

        if (control.type === "checkbox") {
            control.checked = Boolean(value);
            continue;
        }

        for (const button of control.querySelectorAll("[data-value]")) {
            const selected = button.dataset.value === value;

            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }
}

for (const control of preferenceControls) {
    const key = control.dataset.preference;

    if (control.type === "checkbox") {
        control.addEventListener("change", () => {
            setPreference(key, control.checked);
            renderPreferences();
        });
        continue;
    }

    for (const button of control.querySelectorAll("[data-value]")) {
        button.addEventListener("click", () => {
            setPreference(key, button.dataset.value);
            renderPreferences();
        });
    }
}

/*
 * =========================================================
 * OPENING AND CLOSING
 * =========================================================
 */

$("settingsButton").addEventListener("click", () => {
    renderThemeOptions();
    renderDiceSettings();
    renderPreferences();

    show(settingsOverlay);
});

function closeSettings() {
    closeColorPicker();
    hide(settingsOverlay);
}

$("closeSettings").addEventListener("click", closeSettings);

// Clicking the backdrop or pressing Escape also closes it (see overlays.js): take the colour grid along
settingsOverlay.addEventListener("click", event => {
    if (event.target === settingsOverlay) {
        closeColorPicker();
    }
});
