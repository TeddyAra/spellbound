import { $, element, hide, isPhone, show } from "./dom.js";
import { state, commit, onStateChange, saveWithoutUndo, addLog } from "./state.js";
import { preference } from "./preferences.js";
import { confirmAction } from "./confirm.js";
import { SCRABBLE_LETTERS } from "./tiles.js";
import {
    BLANK,
    addToSpell,
    clearedBoard,
    lastLetterIsWholeWord,
    removeFromSpell,
    removeFromTray,
    removeLastFromSpell,
    resetSpell,
    setKept,
    spellText,
    spellWords,
    trayGroups,
    typeLetter
} from "./tileTray.js";

/*
 * The phone's tile view: a tray of your tiles, and the spell you're making out
 * of them. Tap a tile to move it up into the spell and tap it there to send it
 * back, or use the keyboard, which does the same. Hold a tile to keep it or
 * return it to the pile. It takes the place of everything but the spell being
 * cast (see phone.js for that). The logic is in tileTray.js.
 */

const root = document.documentElement;
const view = $("tileView");
const spellBox = $("tileSpell");
const trayBox = $("tileTray");
const statusLine = $("tileStatus");
const typingInput = $("tileTyping");

const HOLD_TIME = 450;
const HOLD_SLIP = 10;

// The next letter starts a new word
let pendingSpace = false;

// Set after a letter that's run out, until the next change
let message = "";

/*
 * =========================================================
 * DRAWING
 * =========================================================
 */

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function tileElement(letter, shown = letter) {
    const tile = element("div", "scrabble-letter", shown);
    const points = SCRABBLE_LETTERS[shown]?.[1];

    tile.setAttribute("role", "button");

    // A blank is worth nothing, whichever letter it stands for
    if (letter !== BLANK && points !== undefined) {
        tile.append(element("span", "scrabble-letter-value", points));
    }

    return tile;
}

function renderSpell() {
    const words = spellWords(state.board);

    if (!words.length) {
        spellBox.replaceChildren(element("p", "tile-placeholder", "Tap your tiles to spell"));

        return;
    }

    const wordBoxes = words.map(word => {
        const box = element("div", "spell-word");

        box.append(...word.map(tile => {
            const node = tileElement(tile.letter, tile.as ?? tile.letter);
            const name = tile.as ? `blank standing for ${tile.as}` : tile.letter;

            node.classList.toggle("stand-in", Boolean(tile.as));
            node.setAttribute("aria-label", `Send ${name} back to the tray`);

            node.addEventListener("click", () => {
                removeFromSpell(state.board, tile);
                changed();
            });

            return node;
        }));

        return box;
    });

    if (pendingSpace) {
        wordBoxes.push(element("div", "spell-next-word"));
    }

    spellBox.replaceChildren(...wordBoxes);
}

function renderTray() {
    const groups = trayGroups(state.board);

    if (!groups.length) {
        const text = state.board.length ? "All your tiles are in the spell" : "No tiles yet";

        trayBox.replaceChildren(element("p", "tile-placeholder", text));

        return;
    }

    trayBox.replaceChildren(...groups.map(group => {
        const { letter, kept, count } = group;
        const node = tileElement(letter);
        const name = letter === BLANK ? "blank tile" : letter;

        node.classList.toggle("kept", kept);
        node.setAttribute("aria-label", `${name}${kept ? ", kept" : ""}, ${count}. Tap to spell, hold for more.`);

        if (count > 1) {
            node.append(element("span", "tile-count", `×${count}`));
        }

        onTapOrHold(node, () => {
            addToSpell(state.board, letter, { kept, newWord: pendingSpace });
            pendingSpace = false;
            changed();
        }, () => openTileMenu(group));

        return node;
    }));
}

function renderStatus() {
    const total = state.board.length;
    const words = spellWords(state.board);
    const used = words.flat().length;

    statusLine.textContent = message || (used
        ? `${plural(words.length, "word")} · ${used} of ${plural(total, "tile")} used`
        : plural(total, "tile"));

    statusLine.classList.toggle("attention", Boolean(message));

    $("tileSpaceButton").disabled = !used || pendingSpace;
    $("tileDeleteButton").disabled = !used;
    $("tileResetButton").disabled = !used;
    $("tileClearButton").disabled = !total;
}

function render() {
    if (!isPhone()) {
        return;
    }

    renderSpell();
    renderTray();
    renderStatus();

    $("phoneTilesCount").textContent = state.board.length || "";

    fitToScreen();
}

/*
 * =========================================================
 * FITTING ON THE SCREEN
 * =========================================================
 *
 * The view doesn't scroll, so everything has to fit: the tiles get smaller when
 * they need to. With the keyboard open there's little room, and you don't need
 * what's beneath the tray or the spell being cast while typing, so those go
 * first. Only a screen too small for all that, like a phone on its side with a
 * spell being cast, can still scroll.
 */

const viewBody = $("tileViewBody");

const TILE_SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

// While the keyboard's open, less is given up on tile size before moving on to the next level
const SMALLEST_SCALE_BEFORE_LEVEL = 0.8;

function fitTiles() {
    const levels = document.activeElement === typingInput ? ["full", "compact", "minimal"] : ["full"];

    root.classList.remove("tile-view-scrolls");

    for (const level of levels) {
        root.dataset.tileFit = level;

        for (const scale of TILE_SCALES) {
            if (level !== levels.at(-1) && scale < SMALLEST_SCALE_BEFORE_LEVEL) {
                break;
            }

            root.style.setProperty("--tile-fit", scale);

            if (viewBody.scrollHeight <= viewBody.clientHeight + 1) {
                return;
            }
        }
    }

    root.classList.add("tile-view-scrolls");
}

function fitToScreen() {
    if (!isPhone() || !isOpen()) {
        return;
    }

    // The part of the screen that can be seen, which excludes a keyboard on any phone
    const { visualViewport: seen } = window;

    if (seen) {
        root.style.setProperty("--tile-view-height", `${seen.height * seen.scale}px`);
    }

    // An iPhone can push the page up when the keyboard opens
    window.scrollTo(0, 0);

    fitTiles();
}

window.visualViewport?.addEventListener("resize", fitToScreen);
window.visualViewport?.addEventListener("scroll", fitToScreen);

/* After moving tiles around. Like a tile moved on the desktop, it's not a step to undo. */
function changed() {
    message = "";

    saveWithoutUndo();
    render();
}

onStateChange(() => {
    message = "";
    render();
});

/*
 * =========================================================
 * SPELLING
 * =========================================================
 */

function refuseLetter(letter) {
    message = `No ${letter} left, and no blank to use instead`;

    renderStatus();

    trayBox.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
        { duration: 180 }
    );
}

function startNewWord() {
    if (spellWords(state.board).length && !pendingSpace) {
        pendingSpace = true;
        message = "";

        render();
    }
}

/* The last thing added: a space waiting for its word, or a letter. The space before a word outlasts the word, like in any text. */
function deleteLast() {
    if (pendingSpace) {
        pendingSpace = false;
        render();

        return;
    }

    const keepSpace = lastLetterIsWholeWord(state.board);

    if (removeLastFromSpell(state.board)) {
        pendingSpace = keepSpace;
        changed();
    }
}

function typeCharacter(character) {
    if (character === " ") {
        startNewWord();

        return;
    }

    const letter = character.toUpperCase();

    if (!/^[A-Z]$/.test(letter)) {
        return;
    }

    if (typeLetter(state.board, letter, { newWord: pendingSpace })) {
        pendingSpace = false;
        changed();
    } else {
        refuseLetter(letter);
    }
}

$("tileSpaceButton").addEventListener("click", startNewWord);
$("tileDeleteButton").addEventListener("click", deleteLast);

$("tileResetButton").addEventListener("click", () => {
    resetSpell(state.board);
    pendingSpace = false;
    changed();
});

/*
 * =========================================================
 * THE KEYBOARD
 * =========================================================
 *
 * An input nobody sees, with one character kept in it. Phone keyboards don't
 * reliably say which key was pressed, so this goes by what's in it afterwards:
 * anything after that character was typed, and if it's gone that was Backspace.
 */

const KEEP = " ";

function resetTyping() {
    typingInput.value = KEEP;
    typingInput.setSelectionRange(1, 1);
}

typingInput.addEventListener("input", () => {
    const { value } = typingInput;

    if (value.startsWith(KEEP) && value.length) {
        [...value.slice(1)].forEach(typeCharacter);
    } else {
        deleteLast();
    }

    resetTyping();
});

typingInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        typingInput.blur();
    }
});

typingInput.addEventListener("focus", () => {
    resetTyping();
    $("tileKeyboardButton").textContent = "Hide keys";
    fitToScreen();
});

typingInput.addEventListener("blur", () => {
    $("tileKeyboardButton").textContent = "Keyboard";
    fitToScreen();
});

$("tileKeyboardButton").addEventListener("click", () => {
    if (document.activeElement === typingInput) {
        typingInput.blur();
    } else {
        typingInput.focus();
    }
});

// Pressing a button or a tile doesn't take the focus away, which would close the keyboard
view.addEventListener("mousedown", event => {
    if (event.target !== typingInput) {
        event.preventDefault();
    }
});

/*
 * =========================================================
 * HOLDING A TILE
 * =========================================================
 */

function onTapOrHold(node, onTap, onHold) {
    let timer = null;
    let held = false;
    let start = null;

    const cancel = () => {
        clearTimeout(timer);
        timer = null;
    };

    node.addEventListener("pointerdown", event => {
        held = false;
        start = { x: event.clientX, y: event.clientY };

        timer = setTimeout(() => {
            held = true;
            timer = null;

            onHold();
        }, HOLD_TIME);
    });

    // A finger that slides is scrolling
    node.addEventListener("pointermove", event => {
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLIP) {
            cancel();
        }
    });

    node.addEventListener("pointerup", cancel);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("pointerleave", cancel);

    // Phones open their own menu for a long press
    node.addEventListener("contextmenu", event => event.preventDefault());

    node.addEventListener("click", () => {
        if (!held) {
            onTap();
        }

        held = false;
    });
}

const tileMenu = $("tileMenuOverlay");

// The group of tiles the menu is about
let menuGroup = null;

function openTileMenu(group) {
    menuGroup = group;

    const name = group.letter === BLANK ? "blank tile" : group.letter;

    $("tileMenuTitle").textContent = group.letter === BLANK ? "Blank tile" : `Tile ${group.letter}`;

    $("tileMenuNote").textContent = group.kept
        ? `This ${name} stays when the board is cleared.`
        : "Kept tiles stay when the board is cleared, for your next casting turn.";

    $("tileKeepButton").textContent = group.kept ? "Stop keeping it" : "Keep it";

    show(tileMenu);
}

$("tileKeepButton").addEventListener("click", () => {
    setKept(state.board, menuGroup.letter, !menuGroup.kept);

    hide(tileMenu);
    changed();
});

$("tileReturnButton").addEventListener("click", () => {
    const { letter, kept } = menuGroup;

    removeFromTray(state.board, letter, kept);

    hide(tileMenu);
    commit(`Returned ${letter === BLANK ? "a blank tile" : letter} to the pile`, { toast: true });
});

$("tileMenuCancel").addEventListener("click", () => hide(tileMenu));

/*
 * =========================================================
 * GETTING AND CLEARING TILES
 * =========================================================
 */

$("tileGetButton").addEventListener("click", () => $("getTilesButton").click());

async function clearBoard() {
    const removed = state.board.filter(tile => !tile.kept).length;

    if (removed && preference("confirmClearBoard")) {
        const confirmed = await confirmAction("Clear Board", `Remove ${plural(removed, "tile")}? Tiles you're keeping stay.`, "Clear");

        if (!confirmed) {
            return;
        }
    }

    const spelled = spellText(state.board);

    state.board = clearedBoard(state.board);

    // Clearing the board also ends the spell that was cast
    state.action = null;
    pendingSpace = false;

    commit("Cleared the board", { toast: true });

    if (removed) {
        addLog("Cleared the board", spelled ? `Spelled: ${spelled}` : plural(removed, "tile"));
    }

    leaveView();
}

$("tileClearButton").addEventListener("click", clearBoard);

/*
 * =========================================================
 * OPENING AND LEAVING
 * =========================================================
 *
 * Opening adds a step to the browser's history, so a phone's own back button
 * leaves this view rather than the site.
 */

const isOpen = () => root.classList.contains("tile-view");

function openView() {
    if (!isOpen()) {
        root.classList.add("tile-view");
        history.pushState({ tileView: true }, "");
    }

    render();
}

function closeView() {
    typingInput.blur();
    root.classList.remove("tile-view");
}

function leaveView() {
    if (isOpen() && history.state?.tileView) {
        history.back();
    } else {
        closeView();
    }
}

window.addEventListener("popstate", () => {
    if (isOpen()) {
        closeView();
    }
});

$("phoneTilesButton").addEventListener("click", openView);
$("tileBackButton").addEventListener("click", leaveView);

// Reloading the page stays in this view, which is still the step in the history
if (isPhone() && history.state?.tileView) {
    root.classList.add("tile-view");
}

// Drawing tiles brings them up (see tiles.js)
document.addEventListener("tilesdrawn", () => {
    if (isPhone()) {
        openView();
    }
});
