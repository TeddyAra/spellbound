import { $, show, hide } from "./dom.js";
import { undo, undoLabel, onStateChange } from "./state.js";

/*
 * Undo (see the UNDO section of state.js): the button by the character's name,
 * Ctrl+Z, and a short message after things that are easy to do by accident.
 */

const undoButton = $("undoButton");
const toast = $("undoToast");
const toastText = $("undoToastText");
const toastButton = $("undoToastButton");

const TOAST_TIME = 8000;

let toastTimer = null;

function showToast(text, canUndo) {
    toastText.textContent = text;
    toastButton.classList.toggle("hidden", !canUndo);

    show(toast);

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(toast), TOAST_TIME);
}

function undoLastStep() {
    const label = undo();

    if (label) {
        showToast(`Undid: ${label}`, false);
    }
}

/* Not while dice are rolling or a roll's result is open: that roll was worked out from the character as it is now. */
const rollInProgress = () => !$("animationOverlay").classList.contains("hidden")
    || !$("rollResultOverlay").classList.contains("hidden");

function renderUndoButton() {
    const label = undoLabel();

    undoButton.disabled = !label;
    undoButton.title = label ? `Undo: ${label} (Ctrl+Z)` : "Nothing to undo";
}

undoButton.addEventListener("click", undoLastStep);
toastButton.addEventListener("click", undoLastStep);

// Ctrl+Z in a text box still undoes the typing, as it always does
document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") {
        return;
    }

    if (event.target.closest?.("input, textarea, select") || rollInProgress()) {
        return;
    }

    event.preventDefault();
    undoLastStep();
});

document.addEventListener("undoable", event => showToast(event.detail, true));

onStateChange(renderUndoButton);
