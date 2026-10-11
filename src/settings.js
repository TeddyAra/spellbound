import { $, show, hide, element } from "./dom.js";

/*
 * The Settings window: preferences for this browser, not the character.
 * For now that's the theme, which sets data-theme on <html> (see the themes
 * at the top of style.css). The page sets it again before drawing, from the
 * same storage key, so the default doesn't flash first (see index.html).
 */

const THEME_KEY = "spellboundTheme";

// Theme key → name, a short description, and swatches for its preview
const THEMES = {
    original: {
        name: "Original",
        description: "Dark, with violet accents",
        swatches: ["#101116", "#1b1d25", "#9d7cff", "#f3f3f5"]
    },
    blueprint: {
        name: "Blueprint",
        description: "Cream graph paper and cobalt ink",
        swatches: ["#ebe2cd", "#f3ecdc", "#1f4fc9", "#e8592b"]
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

$("settingsButton").addEventListener("click", () => {
    renderThemeOptions();
    show(settingsOverlay);
});

$("closeSettings").addEventListener("click", () => hide(settingsOverlay));

applyTheme(savedTheme());
