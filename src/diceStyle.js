/*
 * How the 3D dice look: their colour (or two colours swirled together), the
 * colour of the numbers, and a finish. Saved in this browser.
 * (See diceSettings.js for the window, dice.js for the dice.)
 *
 * A finish is one of the dice library's materials (how light plays on the dice)
 * with one of its textures (a pattern printed on them); the texture images are
 * in public/dice/textures. `adjust` changes the material after the library
 * made it (see dice.js).
 */

const STYLE_KEY = "spellDiceStyle";

// "random" picks one of these for every roll
export const RANDOM_COLORS = [
    "#00ffcb",
    "#ff6600",
    "#1d66af",
    "#7028ed",
    "#c4c427",
    "#d81128"
];

// material: "none" (plastic) | "metal" | "wood"
export const DICE_FINISHES = {
    metal: { name: "Metal", material: "metal", texture: "none" },

    // The library's own "perfect metal" is a mirror with nothing to reflect: it comes out black.
    // This is its metal, made shinier.
    polished: { name: "Polished metal", material: "metal", texture: "none", adjust: { roughness: 0.15, metalness: 0.35 } },

    plastic: { name: "Plastic", material: "none", texture: "none" },
    steel: { name: "Brushed steel", material: "metal", texture: "metal" },
    wood: { name: "Wood", material: "wood", texture: "wood" },
    stars: { name: "Starry", material: "none", texture: "stars" }
};

const DEFAULT_STYLE = { color: "random", twoTone: false, color2: "random", labelColor: "#ffffff", finish: "metal" };

export function loadDiceStyle() {
    try {
        const style = { ...DEFAULT_STYLE, ...JSON.parse(localStorage.getItem(STYLE_KEY)) };

        // Finishes that were taken out
        if (!DICE_FINISHES[style.finish]) {
            style.finish = DEFAULT_STYLE.finish;
        }

        return style;
    } catch {
        return { ...DEFAULT_STYLE };
    }
}

export function saveDiceStyle(style) {
    try {
        localStorage.setItem(STYLE_KEY, JSON.stringify(style));
    } catch {
        // Not remembered
    }
}

function pick(color, not = null) {
    if (color !== "random") {
        return color;
    }

    const choices = RANDOM_COLORS.filter(other => other !== not);

    return choices[Math.floor(Math.random() * choices.length)];
}

const SWIRL_SIZE = 512;

/*
 * Two colours swirled together, like two-tone resin. The library fills each face
 * with the dice colour, and a canvas can fill with a pattern as well as a colour.
 */
function swirl(first, second) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const random = () => Math.random() * SWIRL_SIZE;

    canvas.width = canvas.height = SWIRL_SIZE;
    context.fillStyle = first;
    context.fillRect(0, 0, SWIRL_SIZE, SWIRL_SIZE);

    context.filter = "blur(12px)";
    context.lineCap = "round";

    // Thick bands of the second colour, with a thinner vein of the first running back through
    for (let i = 0; i < 9; i++) {
        context.strokeStyle = i % 3 === 2 ? first : second;
        context.lineWidth = i % 3 === 2 ? 20 + Math.random() * 30 : 50 + Math.random() * 70;

        context.beginPath();
        context.moveTo(random(), random());
        context.bezierCurveTo(random(), random(), random(), random(), random(), random());
        context.stroke();
    }

    return context.createPattern(canvas, "repeat");
}

/* The dice library's colour set for the next roll. */
export function diceColorset(style = loadDiceStyle()) {
    const finish = DICE_FINISHES[style.finish];
    const first = pick(style.color);
    const background = style.twoTone ? swirl(first, pick(style.color2, first)) : first;

    return {
        background,
        foreground: style.labelColor,
        outline: style.labelColor,
        texture: finish.texture,
        material: finish.material
    };
}
