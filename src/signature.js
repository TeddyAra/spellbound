import { $ } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    characterClass,
    maxSignatureUses,
    signatureHasUses,
    maxRunes,
    signatureActive,
    endSignature
} from "./state.js";

/*
 * The class's signature ability. Most last a few rounds once started, counted
 * down with Next round, and come back after a long rest. Spellfury lasts until
 * the end of the combat instead, so it's simply clicked off again. Written
 * Word and Construct have no uses: a Runesmith counts the runes they have out
 * instead, and a Golemwright's construct has its own column (see construct.js).
 */

const signatureButton = $("signatureButton");
const runeCounter = $("runeCounter");
const nextRoundButton = $("nextRoundButton");

const usesLeft = () => maxSignatureUses() - state.signature.used;

export function renderSignature() {
    const signature = characterClass().signature;
    const hasUses = signatureHasUses();

    signatureButton.classList.toggle("hidden", !hasUses);
    runeCounter.classList.toggle("hidden", !signature.runes);

    // Only abilities that last a number of rounds are counted down
    nextRoundButton.classList.toggle("hidden", state.signature.roundsLeft === 0);

    if (signature.runes) {
        $("runeCount").textContent = `${state.runes} / ${maxRunes()}`;
        runeCounter.title = `Runes you have out. ${characterClass().features.find(feature => feature.name === "Runes").text}`;
    }

    if (!hasUses) {
        return;
    }

    const active = signatureActive();
    const rounds = state.signature.roundsLeft;

    $("signatureName").textContent = signature.name;
    $("signatureUses").textContent = active ? "Active" : `${usesLeft()} / ${maxSignatureUses()}`;
    $("roundsLeftDisplay").textContent = `${rounds} ${rounds === 1 ? "round" : "rounds"} left`;

    signatureButton.classList.toggle("active", active);
    signatureButton.classList.toggle("roll-disabled", !active && usesLeft() <= 0);

    const ending = signature.untilCombatEnds ? "Click to end it, e.g. when the combat ends." : "Click to end it early.";

    signatureButton.title = active
        ? `${signature.text}\n\n${ending}`
        : usesLeft() > 0
            ? `${signature.text}\n\nClick to start it as a bonus action during your pre-turn.`
            : `${signature.text}\n\nNo uses left. They come back after a long rest.`;
}

signatureButton.addEventListener("click", () => {
    if (signatureActive()) {
        endSignature();
    } else if (usesLeft() > 0) {
        state.signature.used++;

        if (characterClass().signature.untilCombatEnds) {
            state.signature.ongoing = true;
        } else {
            state.signature.roundsLeft = characterClass().signature.rounds;
        }
    }

    commit(characterClass().signature.name);
});

nextRoundButton.addEventListener("click", () => {
    state.signature.roundsLeft = Math.max(0, state.signature.roundsLeft - 1);
    commit("Next round");
});

function counterButton(id, change) {
    $(id).addEventListener("click", () => {
        change();
        commit("Changed the runes");
    });
}

counterButton("runePlus", () => state.runes = Math.min(maxRunes(), state.runes + 1));
counterButton("runeMinus", () => state.runes = Math.max(0, state.runes - 1));

onStateChange(renderSignature);
