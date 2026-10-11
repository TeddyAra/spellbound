import { $, show, hide } from "./dom.js";

/*
 * A yes/no window in the dashboard's own style, instead of the browser's.
 * Resolves with true when confirmed, false when cancelled or closed.
 */

const overlay = $("confirmOverlay");

let settle = null;

function finish(result) {
    hide(overlay);

    if (settle) {
        settle(result);
        settle = null;
    }
}

export function confirmAction(title, message, confirmLabel = "Confirm") {
    // Answering an earlier question with "no" if it's somehow still open
    finish(false);

    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    $("confirmYes").textContent = confirmLabel;

    show(overlay);
    $("confirmYes").focus();

    return new Promise(resolve => {
        settle = resolve;
    });
}

$("confirmYes").addEventListener("click", () => finish(true));
$("confirmNo").addEventListener("click", () => finish(false));

overlay.addEventListener("click", event => {
    if (event.target === overlay) {
        finish(false);
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && settle) {
        finish(false);
    }
});
