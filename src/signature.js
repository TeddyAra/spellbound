import { $, hide } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    characterClass,
    maxSignatureUses,
    signatureActive
} from "./state.js";

/*
 * The class's signature ability. Most last 3 rounds once started, counted
 * down with Next round, and come back after a long rest. A Runesmith's
 * Glyphs are counted instead: how many are placed out of the maximum.
 */

const ROUNDS = 3;

const signatureButton = $("signatureButton");
const glyphCounter = $("glyphCounter");
const nextRoundButton = $("nextRoundButton");

const usesLeft = () => maxSignatureUses() - state.signature.used;

export function renderSignature() {
    const signature = characterClass().signature;

    signatureButton.classList.toggle("hidden", Boolean(signature.glyphs));
    glyphCounter.classList.toggle("hidden", !signature.glyphs);

    if (signature.glyphs) {
        $("glyphCount").textContent = `${state.signature.used} / ${maxSignatureUses()}`;
        glyphCounter.title = signature.text;

        hide(nextRoundButton);

        return;
    }

    const active = signatureActive();

    $("signatureName").textContent = signature.name;
    $("signatureUses").textContent = active ? "Active" : `${usesLeft()} / ${maxSignatureUses()}`;

    signatureButton.classList.toggle("active", active);
    signatureButton.classList.toggle("roll-disabled", !active && usesLeft() <= 0);

    signatureButton.title = active
        ? `${signature.text}\n\nClick to end it early.`
        : usesLeft() > 0
            ? `${signature.text}\n\nClick to start it during your pre-turn (doesn't use your action).`
            : `${signature.text}\n\nNo uses left. They come back after a long rest.`;

    nextRoundButton.classList.toggle("hidden", !active);

    const rounds = state.signature.roundsLeft;

    $("roundsLeftDisplay").textContent = `${rounds} ${rounds === 1 ? "round" : "rounds"} left`;
}

signatureButton.addEventListener("click", () => {
    if (signatureActive()) {
        state.signature.roundsLeft = 0;
    } else if (usesLeft() > 0) {
        state.signature.used++;
        state.signature.roundsLeft = ROUNDS;
    }

    commit();
});

nextRoundButton.addEventListener("click", () => {
    state.signature.roundsLeft = Math.max(0, state.signature.roundsLeft - 1);
    commit();
});

$("glyphPlus").addEventListener("click", () => {
    state.signature.used = Math.min(maxSignatureUses(), state.signature.used + 1);
    commit();
});

$("glyphMinus").addEventListener("click", () => {
    state.signature.used = Math.max(0, state.signature.used - 1);
    commit();
});

onStateChange(renderSignature);
