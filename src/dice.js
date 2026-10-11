import DiceBox from "@3d-dice/dice-box-threejs";
import { $, show, hide } from "./dom.js";
import { diceColorset, loadDiceStyle, DICE_FINISHES } from "./diceStyle.js";
import { preference } from "./preferences.js";

const animationOverlay = $("animationOverlay");

const diceBox = new DiceBox("#diceBox", {
    // Where the finishes' texture images are (see diceStyle.js)
    assetPath: `${import.meta.env.BASE_URL}dice/`,

    theme_customColorset: diceColorset(),

    gravity_multiplier: 350,
    strength: 0.5,

    light_intensity: 1,
    baseScale: 100
});

/*
 * The finish's material tweaks (see diceStyle.js), put on every die material
 * the library makes. `adjust` is set before each roll.
 */
let adjust = null;

const diceFactory = diceBox.DiceFactory;
const createMaterials = diceFactory.createMaterials.bind(diceFactory);

diceFactory.createMaterials = (...args) => {
    const materials = createMaterials(...args);

    if (adjust) {
        for (const material of materials) {
            if (typeof adjust === "function") {
                adjust(material);
            } else {
                Object.assign(material, adjust);
            }

            material.needsUpdate = true;
        }
    }

    return materials;
};

/*
 * Fast animation: the library plays the throw back by stepping its physics for
 * the time that passed since the last frame. Making it think more time passed
 * plays the same throw faster, with the same result.
 */
const FAST_SPEED = 2.5;

const animateThrow = diceBox.animateThrow;

diceBox.animateThrow = function (...args) {
    if (preference("diceAnimation") === "fast" && this.last_time) {
        this.last_time -= (Date.now() - this.last_time) * (FAST_SPEED - 1);
    }

    return animateThrow.apply(this, args);
};

let diceBoxReady = false;

diceBox.initialize().then(() => {
    diceBoxReady = true;

    console.log("3D DiceBox initialized.");

    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
    });
}).catch(error => {
    console.error("Failed to initialize DiceBox:", error);
});

function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

/* Returns the rolled values per dice set, e.g. "3d100+3d10" gives [[..3..], [..3..]]. */
function extractDiceResults(results) {
    if (!results || !Array.isArray(results.sets)) {
        console.error("Unexpected DiceBox result:", results);

        return [];
    }

    return results.sets.map(set => {
        const rolls = [];

        const dice = Array.isArray(set.rolls)
            ? set.rolls
            : Array.isArray(set.dice)
                ? set.dice
                : [];

        for (const die of dice) {
            if (typeof die === "number") {
                rolls.push(die);
            } else if (typeof die?.value === "number") {
                rolls.push(die.value);
            }
        }

        return rolls;
    });
}

/*
 * Plays the full-screen 3D dice animation for `notation` (e.g. "3d6") and
 * resolves with the rolled values, or null if the roll couldn't happen.
 */
export async function rollDice(notation) {
    const sets = await rollDiceSets(notation);

    return sets ? sets.flat() : null;
}

/* Combines a tens die (10–100, where "00" is 100) and a d10 (1–10) into 1–100. */
function percentile(tens, units) {
    return (tens % 100) + (units % 10) || 100;
}

/* Rolls `count` percentile dice (a d100 + d10 pair each). Resolves with values 1–100, or null. */
export async function rollPercentiles(count) {
    const sets = await rollDiceSets(`${count}d100+${count}d10`);

    if (!sets) {
        return null;
    }

    const [tens, units] = sets;

    return tens.map((value, index) => percentile(value, units[index]));
}

/* Like rollDice, but keeps the values of each dice set (e.g. "2d100+2d10") separate. */
/*
 * Animation off: the same results without the 3D dice, e.g. "2d100+2d10".
 * A d100 die shows the tens (10 to 100), like the library's.
 */
function rollWithoutDice(notation) {
    return notation.split("+").map(part => {
        const [count, sides] = part.split("d").map(Number);

        return Array.from({ length: count }, () => {
            const value = 1 + Math.floor(Math.random() * (sides === 100 ? 10 : sides));

            return sides === 100 ? value * 10 : value;
        });
    });
}

export async function rollDiceSets(notation) {
    if (preference("diceAnimation") === "off") {
        return rollWithoutDice(notation);
    }

    if (!diceBoxReady) {
        console.warn("DiceBox is not ready yet.");

        return null;
    }

    // Remove the previous roll's dice first, or they flash up when the overlay appears.
    diceBox.clearDice();

    show(animationOverlay);

    // The player's dice style (see diceStyle.js); a random colour is picked again every roll
    const style = loadDiceStyle();

    adjust = DICE_FINISHES[style.finish].adjust ?? null;

    if (DICE_FINISHES[style.finish].shadows === false) {
        diceBox.disableShadows();
    } else {
        diceBox.enableShadows();
    }

    // The library remembers painted faces by their colour, and every two-tone swirl looks the same to it
    diceFactory.materials_cache = {};

    await diceBox.updateConfig({
        theme_customColorset: diceColorset(style)
    });

    // The dice box only knows its real size once it's visible. DiceBox handles
    // "resize" one frame later, and a roll is simulated first and then replayed on
    // screen, so the size must be settled before rolling or the dice that land
    // won't match the results.
    await nextFrame();
    window.dispatchEvent(new Event("resize"));
    await nextFrame();

    try {
        const sets = extractDiceResults(await diceBox.roll(notation));

        if (!sets.flat().length) {
            throw new Error("No dice results were returned.");
        }

        return sets;
    } catch (error) {
        console.error(`Dice roll (${notation}) failed:`, error);

        return null;
    } finally {
        hide(animationOverlay);
    }
}
