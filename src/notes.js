import { $, show, hide } from "./dom.js";
import { state, commit, onStateChange } from "./state.js";

/*
 * A place to type whatever the player wants to remember. Every character has
 * their own notes, saved with each change.
 */

const notesOverlay = $("notesOverlay");
const notesInput = $("notesInput");

// Everything typed in one go is one undo step
let typing = false;

notesInput.addEventListener("input", () => {
    state.notes = notesInput.value;

    commit("Changed the notes", { merge: typing });

    typing = true;
});

notesInput.addEventListener("blur", () => {
    typing = false;
});

/* Only when it's different: setting the text moves the cursor to the end. */
function renderNotes() {
    if (notesInput.value !== state.notes) {
        notesInput.value = state.notes;
    }
}

$("notesButton").addEventListener("click", () => {
    show(notesOverlay);
    notesInput.focus();
});

$("closeNotes").addEventListener("click", () => hide(notesOverlay));

onStateChange(renderNotes);
