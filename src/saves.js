import { $, element } from "./dom.js";
import { onStateChange, rank, schoolName, hasFeat } from "./state.js";
import { SAVING_THROWS, poolNotation } from "./rules.js";
import { openRollSetup } from "./casting.js";

/*
 * The Saves & senses page, in the menu (see menuPages.js) or on the phone:
 * passive Reveal (see character.js), then one button per school that can
 * resist something, each opening the roll window already set to a saving throw.
 */

function saveButton(school) {
    const schoolRank = rank(school);
    const button = element("button", "roll-button save-button");
    const pool = element("span", "school-rank");

    button.type = "button";
    button.dataset.school = school;
    button.title = `${schoolName(school)} saving throw: rank ${schoolRank}, roll ${poolNotation(schoolRank)}` +
        (hasFeat("steadyMind") ? ", plus one die from Steady Mind" : "") +
        `\nResists: ${SAVING_THROWS[school]}`;

    pool.append(element("small", null, poolNotation(schoolRank)), ` ${schoolRank}`);
    button.append(element("span", null, schoolName(school)), pool);

    button.addEventListener("click", () => openRollSetup(school, "save"));

    return button;
}

function render() {
    $("saveButtons").replaceChildren(...Object.keys(SAVING_THROWS).map(saveButton));
}

onStateChange(render);
