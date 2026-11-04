import { $, show, hide, element } from "./dom.js";
import { state, clearLog } from "./state.js";
import { confirmAction } from "./confirm.js";

/*
 * The log: what this character rolled and did, newest first. Entries are
 * written with addLog (see state.js). Most come from showInfoResult in
 * results.js, so anything that shows a result is logged by itself.
 */

const logOverlay = $("logOverlay");
const logList = $("logList");

/* "14:03", or "3 Nov, 14:03" for an earlier day. */
function logTime(at, now = new Date()) {
    const date = new Date(at);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return date.toDateString() === now.toDateString()
        ? time
        : `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

function renderEntry({ at, title, detail, dice }) {
    const entry = element("div", "log-entry");
    const heading = element("div", "log-heading");

    heading.append(element("strong", null, title), element("span", "result-label small", logTime(at)));
    entry.append(heading);

    if (detail) {
        entry.append(element("div", "result-label", detail));
    }

    if (dice?.length) {
        const list = element("div", "dice-list");

        list.append(...dice.map(value => element("div", "die", value)));
        entry.append(list);
    }

    return entry;
}

function renderLog() {
    logList.replaceChildren(...state.log.map(renderEntry));

    $("logEmpty").classList.toggle("hidden", state.log.length > 0);
    $("clearLogButton").disabled = state.log.length === 0;
}

$("logButton").addEventListener("click", () => {
    renderLog();
    show(logOverlay);
});

$("closeLog").addEventListener("click", () => hide(logOverlay));

$("clearLogButton").addEventListener("click", async () => {
    hide(logOverlay);

    if (await confirmAction("Clear Log", "Remove everything from this character's log? This can't be undone.", "Clear")) {
        clearLog();
    }

    show(logOverlay);
});

document.addEventListener("logchange", renderLog);
document.addEventListener("statechange", renderLog);
