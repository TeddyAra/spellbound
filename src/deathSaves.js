import { $, element } from "./dom.js";
import { state, saveState } from "./state.js";
import { rollDice } from "./dice.js";
import { showInfoResult } from "./results.js";
import { updateCurrentHealth } from "./character.js";

/*
 * Death rolls (Dropping to 0 Hit Points): at 0 HP the HP button gets three
 * boxes for successes and three for failures. Click a box to tick it (or untick
 * it), or roll a d20 at the start of every round:
 *   10 or higher   a success          (3 successes: stable)
 *   9 or lower     a failure          (3 failures: dead)
 *   1              two failures
 *   20             you wake up with 1 HP
 * Taking damage at 0 HP is a failure too, and any healing clears them all
 * (see updateCurrentHealth in character.js).
 */

const MAX_SAVES = 3;

const panel = $("deathSaves");

export function isStable() {
    return state.deathSaves.successes >= MAX_SAVES && state.deathSaves.failures < MAX_SAVES;
}

export function isDead() {
    return state.deathSaves.failures >= MAX_SAVES;
}

export function resetDeathSaves() {
    state.deathSaves = { successes: 0, failures: 0 };
}

/* Damage while downed. Doesn't save or redraw: the caller does. */
export function deathSaveFailed(count = 1) {
    state.deathSaves.failures = Math.min(MAX_SAVES, state.deathSaves.failures + count);
}

function renderBoxes(kind) {
    const container = panel.querySelector(`.death-save-boxes[data-kind="${kind}"]`);
    const count = state.deathSaves[kind];

    container.replaceChildren(...Array.from({ length: MAX_SAVES }, (_, index) => {
        const box = element("button", `death-save-box ${index < count ? "checked" : ""}`.trim());
        const label = kind === "successes" ? "success" : "failure";

        box.type = "button";
        box.title = index < count ? `Untick this ${label}` : `Tick a ${label}`;
        box.setAttribute("aria-label", `${label} ${index + 1}`);
        box.setAttribute("aria-pressed", String(index < count));

        // Like checkboxes: clicking the last ticked box unticks it, any other sets the count up to it
        box.addEventListener("click", () => {
            state.deathSaves[kind] = count === index + 1 ? index : index + 1;
            saveState();
            renderDeathSaves();
        });

        return box;
    }));
}

/* Shows the death saves while at 0 HP. */
export function renderDeathSaves() {
    const down = state.currentHealth === 0;

    $("hpManagerButton").classList.toggle("down", down);
    panel.classList.toggle("hidden", !down);

    // Downed characters can't act, so the menu makes room for the death rolls
    $("rollMenu").classList.toggle("downed", down);

    if (!down) {
        return;
    }

    renderBoxes("successes");
    renderBoxes("failures");

    const status = $("deathSaveStatus");

    status.textContent = isDead() ? "Dead" : isStable() ? "Stable" : "";
    status.dataset.kind = isDead() ? "dead" : isStable() ? "stable" : "";

    $("rollDeathSave").disabled = isDead() || isStable();
}

$("rollDeathSave").addEventListener("click", async () => {
    const rolls = await rollDice("1d20");

    if (!rolls) {
        return;
    }

    const roll = rolls[0];
    let result;

    if (roll === 20) {
        // Back on your feet: updateCurrentHealth clears the saves
        updateCurrentHealth(1);
        showInfoResult("Death Roll", [["Roll", roll], ["Result", "Natural 20! You wake up with 1 HP"]]);

        return;
    }

    if (roll >= 10) {
        state.deathSaves.successes = Math.min(MAX_SAVES, state.deathSaves.successes + 1);
        result = isStable() ? "Success: you're stable" : "Success";
    } else {
        deathSaveFailed(roll === 1 ? 2 : 1);
        result = roll === 1 ? "Natural 1: two failures" : "Failure";

        if (isDead()) {
            result += ". You died";
        }
    }

    saveState();
    renderDeathSaves();

    showInfoResult("Death Roll", [
        ["Roll", roll],
        ["Result", result],
        ["Successes", `${state.deathSaves.successes} / ${MAX_SAVES}`],
        ["Failures", `${state.deathSaves.failures} / ${MAX_SAVES}`]
    ]);
});

$("resetDeathSaves").addEventListener("click", () => {
    resetDeathSaves();
    saveState();
    renderDeathSaves();
});
