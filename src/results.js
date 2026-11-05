import { $, show, hide, renderDice } from "./dom.js";
import { addLog } from "./state.js";

const infoResultOverlay = $("infoResultOverlay");

/* "Roll: 12 · Result: Success" */
const logDetail = rows => rows.map(([label, value]) => label ? `${label}: ${value}` : value).join(" · ");

/*
 * Shows a simple result popup, and notes it in the log (see log.js).
 *   rows: [[label, value], ...]
 *   list: optional { title, values } rendered as small boxes (dice, letters)
 *   log:  false for a message that isn't something that happened
 *   action: optional { label, onClick }, a main button that also closes the popup
 */
export function showInfoResult(title, rows, list = null, { log = true, action = null } = {}) {
    if (log) {
        addLog(title, logDetail(rows), list?.values ?? []);
    }

    $("infoResultTitle").textContent = title;

    const container = $("infoResultRows");

    container.innerHTML = "";

    for (const [label, value] of rows) {
        const row = document.createElement("div");
        const labelElement = document.createElement("span");
        const valueElement = document.createElement("strong");

        row.className = "result-row";
        labelElement.className = "result-label";

        labelElement.textContent = label;
        valueElement.textContent = value;

        row.append(labelElement, valueElement);
        container.appendChild(row);
    }

    const listBox = $("infoResultListBox");

    if (list) {
        $("infoResultListTitle").textContent = list.title;
        renderDice($("infoResultList"), list.values);

        show(listBox);
    } else {
        hide(listBox);
    }

    const actionButton = $("infoResultAction");

    actionButton.classList.toggle("hidden", !action);
    actionButton.textContent = action?.label ?? "";
    actionButton.onclick = action && (() => {
        hide(infoResultOverlay);
        action.onClick();
    });

    show(infoResultOverlay);
}

$("closeInfoResult").addEventListener("click", () => hide(infoResultOverlay));
