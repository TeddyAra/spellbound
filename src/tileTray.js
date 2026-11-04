/*
 * The phone's way of handling tiles (see tileView.js), without the page: a tray
 * of tiles, and a spell made by moving them up out of it. A tile in the spell
 * has a `line`, its place in the spell, with a place left empty between words.
 * A blank tile standing in for a letter has that letter as `as`, and a tile
 * that stays when the board is cleared is `kept`.
 *
 * All of these live on the tiles in state.board, next to the x and y the desktop
 * uses, so both layouts work with the same tiles.
 */

export const BLANK = "_";

const inSpell = tile => tile.line !== undefined;

const spellTiles = board => board.filter(inSpell).sort((a, b) => a.line - b.line);

/* The spell's tiles, word by word. */
export function spellWords(board) {
    const words = [];
    let previous = null;

    for (const tile of spellTiles(board)) {
        if (previous === null || tile.line > previous + 1) {
            words.push([]);
        }

        words.at(-1).push(tile);
        previous = tile.line;
    }

    return words;
}

/* Numbers the tiles again from 0, with one empty place between words. */
function setWords(words) {
    let place = 0;

    for (const word of words) {
        for (const tile of word) {
            tile.line = place++;
        }

        place++;
    }
}

/* The tray: how many of each letter is left, in alphabetical order with blanks last. Kept tiles are counted apart. */
export function trayGroups(board) {
    const groups = new Map();

    for (const tile of board.filter(tile => !inSpell(tile))) {
        const kept = Boolean(tile.kept);
        const key = `${tile.letter === BLANK ? "~" : tile.letter}${kept ? 1 : 0}`;

        if (!groups.has(key)) {
            groups.set(key, { letter: tile.letter, kept, count: 0 });
        }

        groups.get(key).count++;
    }

    return [...groups.keys()].sort().map(key => groups.get(key));
}

/* A tile of this letter from the tray, by preference one that isn't being kept. */
function fromTray(board, letter, kept) {
    const matches = board.filter(tile => !inSpell(tile) && tile.letter === letter);

    return kept === undefined
        ? matches.find(tile => !tile.kept) ?? matches[0] ?? null
        : matches.find(tile => Boolean(tile.kept) === kept) ?? null;
}

function appendToSpell(board, tile, newWord) {
    const last = spellTiles(board).at(-1);

    tile.line = last ? last.line + (newWord ? 2 : 1) : 0;

    return tile;
}

/* Moves a tile of this letter up into the spell. Returns it, or null if there's none in the tray. */
export function addToSpell(board, letter, { kept, newWord = false } = {}) {
    const tile = fromTray(board, letter, kept);

    return tile && appendToSpell(board, tile, newWord);
}

/* For typing: the letter if it's in the tray, otherwise a blank standing in for it, otherwise null. */
export function typeLetter(board, letter, { newWord = false } = {}) {
    const tile = addToSpell(board, letter, { newWord }) ?? addToSpell(board, BLANK, { newWord });

    if (tile?.letter === BLANK) {
        tile.as = letter;
    }

    return tile;
}

/* Sends a tile back to the tray, closing the gap it leaves. */
export function removeFromSpell(board, tile) {
    const words = spellWords(board)
        .map(word => word.filter(other => other !== tile))
        .filter(word => word.length);

    delete tile.line;
    delete tile.as;

    setWords(words);
}

/* The last letter back to the tray, or null if the spell is empty. */
export function removeLastFromSpell(board) {
    const tile = spellTiles(board).at(-1) ?? null;

    if (tile) {
        removeFromSpell(board, tile);
    }

    return tile;
}

/* Whether deleting the last letter takes away a whole word, leaving the word before it. */
export function lastLetterIsWholeWord(board) {
    const words = spellWords(board);

    return words.length > 1 && words.at(-1).length === 1;
}

export function resetSpell(board) {
    for (const tile of board) {
        delete tile.line;
        delete tile.as;
    }
}

/* Keeps a tile of this letter, or stops keeping it. Returns it, or null if there's none. */
export function setKept(board, letter, keep) {
    const tile = fromTray(board, letter, !keep);

    if (!tile) {
        return null;
    }

    if (keep) {
        tile.kept = true;
    } else {
        delete tile.kept;
    }

    return tile;
}

/* Takes a tile out of the tray, for good. Returns it, or null if there's none. */
export function removeFromTray(board, letter, kept) {
    const tile = fromTray(board, letter, kept);

    if (tile) {
        board.splice(board.indexOf(tile), 1);
    }

    return tile;
}

/* What's been spelled, as text. A blank nobody gave a letter shows as an underscore. */
export function spellText(board) {
    return spellWords(board)
        .map(word => word.map(tile => tile.as ?? tile.letter).join(""))
        .join(" ");
}

/* What's left after clearing the board: the kept tiles, back in the tray. */
export function clearedBoard(board) {
    const kept = board.filter(tile => tile.kept);

    resetSpell(kept);

    return kept;
}

/*
 * =========================================================
 * ON A DESKTOP
 * =========================================================
 *
 * The desktop board goes by where tiles are, so a spell from a phone becomes a
 * row of tiles, and kept tiles go in the safe zone.
 */

const inZone = (tile, zone, size) => {
    const x = tile.x + size / 2;
    const y = tile.y + size / 2;

    return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
};

/* Whether the board has anything the desktop can't show by itself. */
export function needsDesktopLayout(board, zone, size) {
    return board.some(tile => inSpell(tile) || tile.as !== undefined || (tile.kept && !inZone(tile, zone, size)));
}

/* `area` is where the spell goes: { left, top, width }. Words go on a new row when they don't fit. */
export function layOutForDesktop(board, area, zone, size) {
    const step = size + 2;

    let x = area.left;
    let y = area.top;

    for (const word of spellWords(board)) {
        if (x > area.left && x + word.length * step > area.left + area.width) {
            x = area.left;
            y += size + 22;
        }

        for (const tile of word) {
            tile.x = x;
            tile.y = y;
            tile.rotation = 0;

            x += step;
        }

        // More than the words on the board count as one word
        x += size;
    }

    const perRow = Math.max(1, Math.floor((zone.right - zone.left - 8) / (size + 4)));
    let placed = 0;

    for (const tile of board) {
        const isSpell = inSpell(tile);

        if (tile.kept && !isSpell && !inZone(tile, zone, size)) {
            tile.x = zone.left + 8 + (placed % perRow) * (size + 4);
            tile.y = zone.top + 8 + Math.floor(placed / perRow) * (size + 4);

            placed++;
        }

        delete tile.line;
        delete tile.as;

        // A tile that went into the row isn't in the safe zone any more
        if (isSpell) {
            delete tile.kept;
        }
    }

    return board;
}
