import { $, show, hide, element } from "./dom.js";
import { state, exportCharacter, readCharacterFile, importCharacter } from "./state.js";
import { preference, setPreference } from "./preferences.js";
import { closeColorPicker } from "./colorPicker.js";
import { confirmAction } from "./confirm.js";
import { renderDiceSettings } from "./diceSettings.js";

/*
 * The Settings window: preferences for this browser (see preferences.js),
 * plus exporting and importing the character. The dice colours are in
 * diceSettings.js.
 *
 * The theme sets data-theme on <html> (see the themes in style.css). The page
 * also sets it before drawing, from the same storage key, so the default
 * doesn't flash first (see index.html).
 */

const THEME_KEY = "spellboundTheme";

// Theme key → name, a short description, and swatches for its preview
const THEMES = {
    original: {
        name: "Original",
        description: "Dark, with violet accents",
        swatches: ["#101116", "#1b1d25", "#9d7cff", "#f3f3f5"]
    },
    light: {
        name: "Light",
        description: "The original, but light",
        swatches: ["#f5f5f9", "#ffffff", "#7c5cf0", "#16171d"]
    },
    blueprint: {
        name: "Blueprint",
        description: "Cream graph paper and cobalt ink",
        swatches: ["#ebe2cd", "#f3ecdc", "#1f4fc9", "#e8592b"]
    },
    pop: {
        name: "Pop",
        description: "Sunny gradient and chunky outlines",
        swatches: ["#f4787f", "#fbef82", "#6be675", "#161616"]
    },
    noir: {
        name: "Noir",
        description: "Pitch black with burnt orange",
        swatches: ["#000000", "#222222", "#d4471f", "#ededed"]
    }
};

const settingsOverlay = $("settingsOverlay");

function savedTheme() {
    try {
        const theme = localStorage.getItem(THEME_KEY);

        return THEMES[theme] ? theme : "original";
    } catch {
        return "original";
    }
}

function applyTheme(theme) {
    if (theme === "original") {
        delete document.documentElement.dataset.theme;
    } else {
        document.documentElement.dataset.theme = theme;
    }
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
 * CHARACTER FILES
 * =========================================================
 */

const characterFileMessage = $("characterFileMessage");
const importInput = $("importCharacterInput");

/* "Tamsin" → "tamsin-spellbound.json" */
function characterFileName() {
    const name = state.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return `${name || "character"}-spellbound.json`;
}

$("exportCharacterButton").addEventListener("click", () => {
    const file = new Blob([exportCharacter()], { type: "application/json" });
    const link = element("a");

    link.href = URL.createObjectURL(file);
    link.download = characterFileName();
    link.click();

    URL.revokeObjectURL(link.href);

    characterFileMessage.textContent = `Saved as ${link.download}.`;
});

$("importCharacterButton").addEventListener("click", () => {
    importInput.value = "";
    importInput.click();
});

importInput.addEventListener("change", async () => {
    const file = importInput.files[0];

    if (!file) {
        return;
    }

    let character;

    try {
        character = readCharacterFile(await file.text());
    } catch (error) {
        characterFileMessage.textContent = error.message;

        return;
    }

    const name = character.name?.trim() || "this character";
    const current = state.name.trim() || "your current character";

    hide(settingsOverlay);

    const confirmed = await confirmAction(
        "Import Character",
        `Replace ${current} with ${name}? Export ${current} first if you want to keep them.`,
        "Replace"
    );

    show(settingsOverlay);

    if (confirmed) {
        importCharacter(character);
        characterFileMessage.textContent = `Imported ${name}.`;
    }
});

/*
 * =========================================================
 * OPENING AND CLOSING
 * =========================================================
 */

$("settingsButton").addEventListener("click", () => {
    renderThemeOptions();
    renderDiceSettings();
    renderPreferences();

    characterFileMessage.textContent = "";

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

applyTheme(savedTheme());
