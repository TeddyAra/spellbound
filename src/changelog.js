import { $, element, show, hide } from "./dom.js";
import { CHANGELOG, VERSION, formatDate } from "./version.js";

/* The version in Settings, which opens the list of changes in a window of its own (see version.js). */

function renderChangelog() {
    $("changelogList").replaceChildren(...CHANGELOG.map(({ version, date, changes }) => {
        const entry = element("section", "changelog-entry");
        const heading = element("h3");

        heading.append(`Version ${version}`, element("small", null, formatDate(date)));

        const list = element("ul");
        list.append(...changes.map(change => element("li", null, change)));

        entry.append(heading, list);

        return entry;
    }));
}

$("versionButton").textContent = `Version ${VERSION} · What's new`;

$("versionButton").addEventListener("click", () => {
    renderChangelog();
    show($("changelogOverlay"));
});

$("closeChangelog").addEventListener("click", () => hide($("changelogOverlay")));
