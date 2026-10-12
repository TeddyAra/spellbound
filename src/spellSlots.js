import { $, show, hide, clamp, element, setValue } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    rank,
    schoolName,
    subclassIs,
    isEmptySlot,
    spellSlotCount,
    characterClass,
    featCount
} from "./state.js";
import { MAGIC_SCHOOLS, baseSpellSlots } from "./rules.js";
import { openRollSetup } from "./casting.js";
import { preference, setPreference } from "./preferences.js";

/*
 * Saved spells: a spell you liked, kept in a spell slot at level 1. Casting it
 * rolls its school as normal but draws no tiles (see casting.js).
 */

export const hasEmptySlot = () => state.spellSlots.some(isEmptySlot);

/*
 * =========================================================
 * MAIN SCREEN
 * =========================================================
 */

/* The list folds shut under its heading, which keeps a count of the saved spells. */
function renderFold() {
    const open = preference("savedSpellsOpen");
    const saved = state.spellSlots.filter(slot => !isEmptySlot(slot)).length;

    $("savedSpells").classList.toggle("hidden", !open);
    $("savedSpellsToggle").setAttribute("aria-expanded", String(open));
    $("savedSpellsToggle").classList.toggle("folded", !open);
    $("savedSpellsToggle").title = open ? "Fold your saved spells away" : "Show your saved spells";
    $("savedSpellsCount").textContent = `${saved} / ${state.spellSlots.length}`;
}

$("savedSpellsToggle").addEventListener("click", () => {
    setPreference("savedSpellsOpen", !preference("savedSpellsOpen"));
    renderFold();
});

function renderSavedSpells() {
    renderFold();

    $("savedSpells").replaceChildren(...state.spellSlots.map((slot, index) => {
        const button = element("button", "roll-button");

        if (isEmptySlot(slot)) {
            button.append(element("span", null, "Empty slot"), element("span"));
            button.disabled = true;
            button.classList.add("roll-disabled");
            button.title = "Save a spell after casting it";

            return button;
        }

        const name = slot.name.toUpperCase();

        button.append(
            element("span", null, name),
            element("span", "school-rank", "")
        );

        button.lastChild.append(element("small", null, schoolName(slot.school)), ` ${slot.level}`);
        button.title = `${name}: level ${slot.level} ${schoolName(slot.school)}`;

        button.addEventListener("click", () => openRollSetup(slot.school, "saved", index));

        return button;
    }));
}

/*
 * =========================================================
 * CHARACTER SETTINGS
 * =========================================================
 */

function slotSummary() {
    const parts = [`${baseSpellSlots(state.level)} at level ${state.level}`];

    if (characterClass().extraSlots) {
        parts.push(`+${characterClass().extraSlots} Deep Study`);
    }

    if (subclassIs("archivist")) {
        parts.push("+2 Catalogue");
    }

    if (featCount("extraSlot")) {
        parts.push(`+${featCount("extraSlot")} Extra Slot`);
    }

    return `${spellSlotCount()} slots (${parts.join(", ")})`;
}

/* The rows are rebuilt only when the number of slots changes, so typing isn't interrupted. */
let settingRows = [];

function buildSettingRow(index) {
    const row = element("div", "spell-slot-setting");

    const nameInput = element("input", "modal-input");

    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.placeholder = "Empty slot";
    nameInput.spellcheck = false;
    nameInput.setAttribute("aria-label", `Spell slot ${index + 1}`);

    const schoolInput = element("select", "modal-input");

    schoolInput.setAttribute("aria-label", `Spell slot ${index + 1} school`);

    const levelInput = element("input", "modal-input");

    levelInput.type = "number";
    levelInput.min = 1;
    levelInput.step = 1;
    levelInput.setAttribute("aria-label", `Spell slot ${index + 1} level`);

    const forget = element("button", "item-discard", "×");

    forget.type = "button";
    forget.title = "Forget this spell";
    forget.setAttribute("aria-label", forget.title);

    nameInput.addEventListener("input", () => {
        state.spellSlots[index].name = nameInput.value;
        commit();
    });

    schoolInput.addEventListener("change", () => {
        const slot = state.spellSlots[index];

        slot.school = schoolInput.value;
        slot.level = clamp(slot.level, 1, rank(slot.school));
        commit();
    });

    levelInput.addEventListener("input", () => {
        const value = parseInt(levelInput.value, 10);
        const slot = state.spellSlots[index];

        if (!Number.isNaN(value)) {
            slot.level = clamp(value, 1, rank(slot.school));
            commit();
        }
    });

    levelInput.addEventListener("change", () => {
        levelInput.value = state.spellSlots[index].level;
    });

    forget.addEventListener("click", () => {
        state.spellSlots[index] = { name: "", school: "harm", level: 1 };
        commit();
    });

    row.append(element("span", "result-label", `${index + 1}`), nameInput, schoolInput, levelInput, forget);

    return { row, nameInput, schoolInput, levelInput };
}

function renderSlotSettings() {
    if (settingRows.length !== state.spellSlots.length) {
        settingRows = state.spellSlots.map((_, index) => buildSettingRow(index));
        $("spellSlotSettings").replaceChildren(...settingRows.map(({ row }) => row));
    }

    state.spellSlots.forEach((slot, index) => {
        const { nameInput, schoolInput, levelInput } = settingRows[index];

        setValue(nameInput, slot.name);

        schoolInput.replaceChildren(...MAGIC_SCHOOLS.map(school => {
            const option = element("option", null, schoolName(school));

            option.value = school;

            return option;
        }));

        schoolInput.value = slot.school;

        levelInput.max = rank(slot.school);
        setValue(levelInput, slot.level);
    });

    $("slotSummary").textContent = slotSummary();
}

/*
 * =========================================================
 * SAVING A SPELL
 * =========================================================
 */

const saveSpellOverlay = $("saveSpellOverlay");
const saveSpellInput = $("saveSpellInput");

let savingSchool = "harm";

/* Archivist: Annotated Spells start at level 2. A saved spell is never above the rank. */
function startingLevel(school) {
    const level = subclassIs("archivist") && state.level >= 5 ? 2 : 1;

    return Math.min(level, rank(school));
}

export function openSaveSpell(school) {
    savingSchool = school;

    $("saveSpellInfo").textContent =
        `Saves the spell as a level ${startingLevel(school)} ${schoolName(school)} spell in an empty slot.`;
    $("saveSpellMessage").textContent = "";
    saveSpellInput.value = "";

    show(saveSpellOverlay);
    saveSpellInput.focus();
}

$("saveSpellForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = saveSpellInput.value.trim();
    const index = state.spellSlots.findIndex(isEmptySlot);

    if (!name) {
        $("saveSpellMessage").textContent = "Type the spell you cast.";

        return;
    }

    if (index === -1) {
        $("saveSpellMessage").textContent = "No empty slots. Forget a spell in Character settings first.";

        return;
    }

    state.spellSlots[index] = { name: name.toUpperCase(), school: savingSchool, level: startingLevel(savingSchool) };
    commit();

    hide(saveSpellOverlay);
});

$("cancelSaveSpell").addEventListener("click", () => hide(saveSpellOverlay));

export function renderSpellSlots() {
    renderSavedSpells();
    renderSlotSettings();
}

onStateChange(renderSpellSlots);
