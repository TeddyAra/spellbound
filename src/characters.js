import { $, show, hide, element } from "./dom.js";
import {
    listCharacters,
    switchCharacter,
    addCharacter,
    deleteCharacter,
    exportedWhen,
    exportCharacter,
    markExported,
    readCharacterFile
} from "./state.js";
import { CLASSES, SUBCLASS_LEVEL } from "./rules.js";
import { confirmAction } from "./confirm.js";

/*
 * The Characters window, opened from the character's name: every character
 * saved in this browser, with ways to switch, make, delete, export and import
 * them. The storing is in state.js.
 */

const overlay = $("charactersOverlay");
const message = $("characterFileMessage");
const importInput = $("importCharacterInput");

const characterName = character => character.name.trim() || "Unnamed adventurer";

function classLine({ className, subclass, level }) {
    const info = CLASSES[className] ?? CLASSES.wordweaver;
    const subclassInfo = info.subclasses[subclass];
    const line = `Level ${level} ${info.name}`;

    return subclassInfo && level >= SUBCLASS_LEVEL ? `${line} · ${subclassInfo.name}` : line;
}

/* "Tamsin" → "tamsin-spellbound.json" */
function characterFileName(character) {
    const name = character.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return `${name || "character"}-spellbound.json`;
}

function downloadCharacter(character) {
    // Noted first, so the file knows it was exported too
    markExported(character.id);

    const file = new Blob([exportCharacter(character.id)], { type: "application/json" });
    const link = element("a");

    link.href = URL.createObjectURL(file);
    link.download = characterFileName(character);
    link.click();

    URL.revokeObjectURL(link.href);

    renderCharacters();

    message.textContent = `Saved as ${link.download}.`;
}

async function removeCharacter(character) {
    hide(overlay);

    const confirmed = await confirmAction(
        "Delete Character",
        `Delete ${characterName(character)} for good? This can't be undone, so export them first if you might want them back.`,
        "Delete"
    );

    if (confirmed) {
        deleteCharacter(character.id);
    }

    renderCharacters();
    show(overlay);
}

function renderRow(character) {
    const row = element("div", "character-row");
    const pick = element("button", "character-pick");
    const exportButton = element("button", "character-export", "Export");
    const remove = element("button", "item-discard", "×");
    const exported = element("span", "result-label small", `Last exported: ${exportedWhen(character.lastExported)}`);

    row.classList.toggle("current", character.current);
    exported.classList.toggle("attention", character.exportDue);

    pick.type = "button";
    pick.setAttribute("aria-current", String(character.current));
    pick.title = character.current ? "This is the character you're playing" : `Switch to ${characterName(character)}`;

    pick.append(
        element("strong", null, characterName(character)),
        element("span", "result-label", classLine(character)),
        exported
    );

    pick.addEventListener("click", () => {
        switchCharacter(character.id);
        hide(overlay);
    });

    exportButton.type = "button";
    exportButton.title = `Save ${characterName(character)} to a file, as a backup or to move them to another device`;
    exportButton.addEventListener("click", () => downloadCharacter(character));

    remove.type = "button";
    remove.title = `Delete ${characterName(character)}`;
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", () => removeCharacter(character));

    row.append(pick, exportButton, remove);

    return row;
}

function renderCharacters() {
    $("characterList").replaceChildren(...listCharacters().map(renderRow));
}

$("charactersButton").addEventListener("click", () => {
    message.textContent = "";

    renderCharacters();
    show(overlay);
});

$("newCharacterButton").addEventListener("click", () => {
    addCharacter();
    hide(overlay);
});

$("importCharacterButton").addEventListener("click", () => {
    importInput.value = "";
    importInput.click();
});

importInput.addEventListener("change", async () => {
    const file = importInput.files[0];

    if (!file) {
        return;
    }

    let character;

    try {
        character = readCharacterFile(await file.text());
    } catch (error) {
        message.textContent = error.message;

        return;
    }

    // A new character next to the others, so nothing is replaced
    addCharacter(character);

    renderCharacters();

    message.textContent = `Imported ${character.name?.trim() || "the character"} and switched to them.`;
});

$("closeCharacters").addEventListener("click", () => hide(overlay));
