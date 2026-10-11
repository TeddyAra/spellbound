import { element } from "./dom.js";

/*
 * A colour button: shows the colour, and clicking it opens a grid of colours to
 * pick from, plus "Pick your own…" (the browser's colour picker). Optionally a
 * "Random" choice too, stored as the value "random".
 *
 *   colorPicker({ label, value, random, randomColors, onChange(value) }) → element
 */

const PALETTE = [
    "#d81128", "#ff6600", "#f5a623", "#c4c427", "#4fbf73", "#00a86b",
    "#00ffcb", "#1fb5c9", "#7fb3ff", "#1d66af", "#2b3fd6", "#7028ed",
    "#b03ad8", "#e84393", "#ffb3c7", "#8b1e3f", "#6b3e26", "#b8862b",
    "#ffffff", "#e9e4d6", "#a8abb7", "#5c5f6b", "#2d2f36", "#111216"
];

let openPopover = null;

function closePopover() {
    openPopover?.remove();
    openPopover = null;
}

document.addEventListener("pointerdown", event => {
    if (openPopover && !openPopover.contains(event.target) && !event.target.closest(".color-button")) {
        closePopover();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && openPopover) {
        // Only the popover: the window it's in stays open
        event.stopImmediatePropagation();
        closePopover();
    }
}, true);

function paint(swatch, value, randomColors) {
    swatch.style.background = value === "random"
        ? `conic-gradient(${randomColors.join(", ")}, ${randomColors[0]})`
        : value;
}

export function colorPicker({ label, value, random = false, randomColors = [], onChange }) {
    const button = element("button", "color-button");
    const swatch = element("span", "color-button-swatch");
    const text = element("span", "color-button-text");

    let current = value;

    const show = () => {
        paint(swatch, current, randomColors);
        text.textContent = current === "random" ? "Random" : current.toUpperCase();
        button.title = `${label}: ${text.textContent}. Click to change.`;
    };

    const choose = next => {
        current = next;
        show();
        onChange(next);
    };

    button.type = "button";
    button.setAttribute("aria-label", label);
    button.append(swatch, text);
    show();

    button.addEventListener("click", () => {
        const wasOpen = openPopover?.dataset.for === label;

        closePopover();

        if (wasOpen) {
            return;
        }

        const popover = element("div", "color-popover");
        const grid = element("div", "color-grid");

        popover.dataset.for = label;

        const tile = (color, title) => {
            const option = element("button", "color-tile");

            option.type = "button";
            option.title = title;
            option.setAttribute("aria-label", title);
            option.classList.toggle("selected", color === current);
            paint(option, color, randomColors);
            option.addEventListener("click", () => {
                choose(color);
                closePopover();
            });

            return option;
        };

        grid.append(...PALETTE.map(color => tile(color, color)));

        if (random) {
            const randomTile = tile("random", "A random colour every roll");

            const randomSwatch = element("span", "color-button-swatch");

            // A row with a small rainbow, rather than one big rainbow tile
            randomTile.classList.add("color-random");
            randomTile.style.background = "";
            paint(randomSwatch, "random", randomColors);
            randomTile.append(randomSwatch, element("span", "", "Random every roll"));
            popover.append(randomTile);
        }

        // The browser's own colour picker
        const custom = element("label", "color-custom");
        const input = element("input");

        input.type = "color";
        input.value = current === "random" ? "#7028ed" : current;
        input.addEventListener("input", () => choose(input.value));
        custom.append(input, element("span", "", "Pick your own…"));

        popover.append(grid, custom);
        document.body.appendChild(popover);
        openPopover = popover;

        // Below the button, kept on screen (fixed, so the scrolling window it's in doesn't cut it off)
        const rect = button.getBoundingClientRect();
        const top = Math.min(rect.bottom + 6, window.innerHeight - popover.offsetHeight - 8);
        const left = Math.min(rect.left, window.innerWidth - popover.offsetWidth - 8);

        popover.style.top = `${Math.max(8, top)}px`;
        popover.style.left = `${Math.max(8, left)}px`;
    });

    return button;
}

export function closeColorPicker() {
    closePopover();
}
