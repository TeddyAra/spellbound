import { $, show, hide } from "./dom.js";
import { findWords } from "./words.js";
import { preference } from "./preferences.js";
import { confirmAction } from "./confirm.js";

// Letter → [number of tiles in the bag, points]
const SCRABBLE_LETTERS = {
    A: [9, 1],
    B: [2, 3],
    C: [2, 3],
    D: [4, 2],
    E: [12, 1],
    F: [2, 4],
    G: [3, 2],
    H: [2, 4],
    I: [9, 1],
    J: [1, 8],
    K: [1, 5],
    L: [4, 1],
    M: [2, 3],
    N: [6, 1],
    O: [8, 1],
    P: [2, 3],
    Q: [1, 10],
    R: [6, 1],
    S: [4, 1],
    T: [6, 1],
    U: [4, 1],
    V: [2, 4],
    W: [2, 4],
    X: [1, 8],
    Y: [2, 4],
    Z: [1, 10],
    _: [4, 0]
};

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

// Tile size setting → pixels; the stylesheet matches these (see the PREFERENCES section)
const TILE_SIZES = {
    small: 40,
    normal: 48,
    large: 60
};

const tileSize = () => TILE_SIZES[preference("tileSize")] ?? TILE_SIZES.normal;

const scrabblePool = Object.entries(SCRABBLE_LETTERS)
    .flatMap(([letter, [count]]) => Array(count).fill(letter));

const letterBoard = $("letterBoard");
const safeZone = $("safeZone");

let scrabbleTileZIndex = 20;

/* Every tile's letter and middle point. */
function tileCenters(tiles = allTiles()) {
    return tiles.map(tile => ({
        letter: tile.dataset.letter,
        x: parseFloat(tile.style.left) + tileSize() / 2,
        y: parseFloat(tile.style.top) + tileSize() / 2
    }));
}

/*
 * =========================================================
 * WORDS: a line under tiles that spell a word (see words.js)
 * =========================================================
 */

let underlineUpdateScheduled = false;

function updateWordUnderlines() {
    underlineUpdateScheduled = false;

    for (const line of letterBoard.querySelectorAll(".word-underline")) {
        line.remove();
    }

    const tiles = allTiles();
    const centers = tileCenters(tiles);

    for (const word of findWords(centers, tileSize()).words) {
        const first = centers[word.tiles[0]];
        const last = centers[word.tiles[word.tiles.length - 1]];
        const bottom = Math.max(...word.tiles.map(index => centers[index].y)) + tileSize() / 2;

        const line = document.createElement("div");

        line.className = "word-underline";
        line.style.left = `${first.x - tileSize() / 2}px`;
        line.style.width = `${last.x - first.x + tileSize()}px`;
        line.style.top = `${bottom + 6}px`;

        letterBoard.appendChild(line);
    }
}

/* While dragging, at most once per frame */
function scheduleWordUnderlines() {
    if (!underlineUpdateScheduled) {
        underlineUpdateScheduled = true;
        requestAnimationFrame(updateWordUnderlines);
    }
}

function randomScrabbleLetter() {
    return scrabblePool[Math.floor(Math.random() * scrabblePool.length)];
}

function toTileCount(amount) {
    return Math.max(0, Math.floor(Number(amount) || 0));
}

/*
 * =========================================================
 * CREATING TILES
 * =========================================================
 */

function createScrabbleLetter(letter, index) {
    const tile = document.createElement("div");

    tile.className = "scrabble-letter";
    tile.textContent = letter;
    tile.dataset.letter = letter;

    tile.setAttribute("aria-label", `Scrabble letter ${letter}`);

    const value = document.createElement("span");

    value.className = "scrabble-letter-value";
    value.textContent = SCRABBLE_LETTERS[letter][1];

    tile.appendChild(value);

    // Keep new tiles clear of the side menus.
    const horizontalPadding = 400;
    const verticalPadding = 50;

    const maxX = Math.max(horizontalPadding, window.innerWidth - tileSize() - horizontalPadding);
    const maxY = Math.max(verticalPadding, window.innerHeight - tileSize() - verticalPadding);

    tile.style.left = `${horizontalPadding + Math.random() * (maxX - horizontalPadding)}px`;
    tile.style.top = `${verticalPadding + Math.random() * (maxY - verticalPadding)}px`;

    tile.style.setProperty("--rotation", `${-12 + Math.random() * 24}deg`);

    tile.style.zIndex = String(20 + index);

    makeScrabbleTileDraggable(tile);

    // Back to the pile, e.g. for a Wordweaver's Tile Craft or a Trickster's Sleight
    tile.addEventListener("dblclick", () => {
        tile.remove();
        updateWordUnderlines();
    });

    letterBoard.appendChild(tile);
}

function spawnLetters(letters) {
    letters.forEach(createScrabbleLetter);

    scrabbleTileZIndex += letters.length;

    updateWordUnderlines();
}

export function spawnScrabbleLetters(amount) {
    spawnLetters(Array.from({ length: toTileCount(amount) }, randomScrabbleLetter));
}

/* Spawns `amount` copies of each of the given letters. */
function spawnSelectedScrabbleLetters(letters, amount) {
    const count = toTileCount(amount);

    spawnLetters(letters.flatMap(letter => Array(count).fill(letter)));
}

/*
 * =========================================================
 * DRAGGING
 * =========================================================
 */

function makeScrabbleTileDraggable(tile) {
    let pointerOffsetX = 0;
    let pointerOffsetY = 0;

    let activePointerId = null;

    function moveTile(event) {
        if (event.pointerId !== activePointerId) {
            return;
        }

        const maxX = window.innerWidth - tile.offsetWidth;
        const maxY = window.innerHeight - tile.offsetHeight;

        const x = Math.max(0, Math.min(event.clientX - pointerOffsetX, maxX));
        const y = Math.max(0, Math.min(event.clientY - pointerOffsetY, maxY));

        tile.style.left = `${x}px`;
        tile.style.top = `${y}px`;

        safeZone.classList.toggle("active", tileIsInSafeZone(tile));

        scheduleWordUnderlines();
    }

    function stopDragging(event) {
        if (activePointerId !== null && event.pointerId !== activePointerId) {
            return;
        }

        activePointerId = null;

        tile.classList.remove("dragging");

        try {
            tile.releasePointerCapture(event.pointerId);
        } catch {
            // The pointer may already have been released.
        }

        document.removeEventListener("pointermove", moveTile);
        document.removeEventListener("pointerup", stopDragging);
        document.removeEventListener("pointercancel", stopDragging);

        safeZone.classList.remove("active");

        updateWordUnderlines();
    }

    tile.addEventListener("pointerdown", event => {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        event.preventDefault();

        activePointerId = event.pointerId;

        const rect = tile.getBoundingClientRect();

        pointerOffsetX = event.clientX - rect.left;
        pointerOffsetY = event.clientY - rect.top;

        scrabbleTileZIndex++;
        tile.style.zIndex = scrabbleTileZIndex;

        tile.classList.add("dragging");

        try {
            tile.setPointerCapture(event.pointerId);
        } catch {
            // Pointer capture isn't supported everywhere; dragging still works without it.
        }

        document.addEventListener("pointermove", moveTile);
        document.addEventListener("pointerup", stopDragging);
        document.addEventListener("pointercancel", stopDragging);
    });
}

/*
 * =========================================================
 * SAFE ZONE / CLEAR / SORT
 * =========================================================
 */

function allTiles() {
    return Array.from(letterBoard.querySelectorAll(".scrabble-letter"));
}

function tileIsInSafeZone(tile) {
    const tileRect = tile.getBoundingClientRect();
    const safeRect = safeZone.getBoundingClientRect();

    const tileCenterX = tileRect.left + tileRect.width / 2;
    const tileCenterY = tileRect.top + tileRect.height / 2;

    return (
        tileCenterX >= safeRect.left &&
        tileCenterX <= safeRect.right &&
        tileCenterY >= safeRect.top &&
        tileCenterY <= safeRect.bottom
    );
}

async function clearTilesOutsideSafeZone() {
    const cleared = allTiles().filter(tile => !tileIsInSafeZone(tile));

    if (cleared.length && preference("confirmClearBoard")) {
        const tiles = cleared.length === 1 ? "1 tile" : `${cleared.length} tiles`;
        const confirmed = await confirmAction("Clear Board", `Remove ${tiles} outside the safe zone?`, "Clear");

        if (!confirmed) {
            return;
        }
    }

    for (const tile of allTiles()) {
        if (!tileIsInSafeZone(tile)) {
            tile.remove();
        }
    }

    // Clearing the board also ends the spell that was cast.
    hide($("actionPanel"));

    updateWordUnderlines();
}

/* Scatters a group of tiles randomly within `area`. */
function placePile(tiles, area) {
    for (const tile of tiles) {
        const maxX = Math.max(area.x, area.x + area.width - tile.offsetWidth);
        const maxY = Math.max(area.y, area.y + area.height - tile.offsetHeight);

        tile.style.left = `${area.x + Math.random() * (maxX - area.x)}px`;
        tile.style.top = `${area.y + Math.random() * (maxY - area.y)}px`;
    }
}

/* Moves every tile outside the safe zone into vowel, consonant and blank piles. */
function sortTiles() {
    const groups = {
        vowels: [],
        consonants: [],
        blanks: []
    };

    for (const tile of allTiles()) {
        if (tileIsInSafeZone(tile)) {
            continue;
        }

        const letter = tile.dataset.letter;

        if (letter === "_") {
            groups.blanks.push(tile);
        } else if (VOWELS.has(letter)) {
            groups.vowels.push(tile);
        } else {
            groups.consonants.push(tile);
        }
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    placePile(groups.vowels, {
        x: width * 0.25,
        y: 280,
        width: width * 0.19,
        height: height * 0.32
    });

    placePile(groups.consonants, {
        x: width * 0.55,
        y: 280,
        width: width * 0.19,
        height: height * 0.32
    });

    placePile(groups.blanks, {
        x: width * 0.4,
        y: height * 0.72,
        width: width * 0.15,
        height: height * 0.1
    });

    updateWordUnderlines();
}

$("clearTilesButton").addEventListener("click", clearTilesOutsideSafeZone);
$("sortTilesButton").addEventListener("click", sortTiles);

// The underlines follow the tiles when their size changes
document.addEventListener("preferenceschange", updateWordUnderlines);

/*
 * =========================================================
 * GET TILES OVERLAY
 * =========================================================
 */

const tileCountOverlay = $("tileCountOverlay");
const tileCountInput = $("tileCountInput");

// A toggle per letter, to get specific tiles
$("tileSelectionGrid").replaceChildren(...Object.keys(SCRABBLE_LETTERS).map(letter => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    checkbox.type = "checkbox";
    checkbox.value = letter;
    text.textContent = letter;

    label.append(checkbox, text);

    return label;
}));

function tileCheckboxes() {
    return Array.from(document.querySelectorAll("#tileSelectionGrid input[type='checkbox']"));
}

$("getTilesButton").addEventListener("click", () => {
    tileCountInput.value = 1;

    for (const checkbox of tileCheckboxes()) {
        checkbox.checked = false;
    }

    show(tileCountOverlay);
});

$("cancelTiles").addEventListener("click", () => hide(tileCountOverlay));

$("getTiles").addEventListener("click", () => {
    const selectedLetters = tileCheckboxes()
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    if (selectedLetters.length === 0) {
        spawnScrabbleLetters(tileCountInput.value);
    } else {
        spawnSelectedScrabbleLetters(selectedLetters, tileCountInput.value);
    }

    hide(tileCountOverlay);
});
