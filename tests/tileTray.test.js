import { describe, expect, it } from "vitest";
import { findWords } from "../src/words.js";
import {
    addToSpell,
    clearedBoard,
    layOutForDesktop,
    needsDesktopLayout,
    removeFromSpell,
    removeFromTray,
    removeLastFromSpell,
    lastLetterIsWholeWord,
    resetSpell,
    setKept,
    spellText,
    spellWords,
    trayGroups,
    typeLetter
} from "../src/tileTray.js";

const board = letters => [...letters].map((letter, index) => ({ letter, x: 500 + index, y: 300, rotation: 3, z: 20 }));

const type = (tiles, text) => {
    let newWord = false;

    for (const character of text) {
        if (character === " ") {
            newWord = true;
        } else {
            typeLetter(tiles, character, { newWord });
            newWord = false;
        }
    }
};

const tray = tiles => trayGroups(tiles).map(({ letter, count, kept }) => `${letter}${count}${kept ? "k" : ""}`);

describe("the tray", () => {
    it("sorts the letters and counts them, with blanks last", () => {
        expect(tray(board("NA_NB"))).toEqual(["A1", "B1", "N2", "_1"]);
    });

    it("leaves out tiles in the spell", () => {
        const tiles = board("NNA");

        addToSpell(tiles, "N");

        expect(tray(tiles)).toEqual(["A1", "N1"]);
    });

    it("counts kept tiles apart from the others", () => {
        const tiles = board("NNN");

        setKept(tiles, "N", true);

        expect(tray(tiles)).toEqual(["N2", "N1k"]);
    });
});

describe("spelling", () => {
    it("adds tiles in order, in words", () => {
        const tiles = board("EMBERRAIN");

        type(tiles, "EMBER RAIN");

        expect(spellText(tiles)).toBe("EMBER RAIN");
        expect(spellWords(tiles).map(word => word.length)).toEqual([5, 4]);
        expect(trayGroups(tiles)).toEqual([]);
    });

    it("doesn't start a new word before the first letter", () => {
        const tiles = board("AB");

        addToSpell(tiles, "A", { newWord: true });

        expect(tiles[0].line).toBe(0);
    });

    it("refuses a letter that's run out", () => {
        const tiles = board("A");

        expect(addToSpell(tiles, "B")).toBeNull();
        expect(typeLetter(tiles, "B")).toBeNull();
        expect(spellText(tiles)).toBe("");
    });

    it("uses a blank for a typed letter that's run out", () => {
        const tiles = board("A_");

        type(tiles, "AZ");

        expect(spellText(tiles)).toBe("AZ");
        expect(tray(tiles)).toEqual([]);
    });

    it("prefers the real letter over a blank", () => {
        const tiles = board("_A");

        typeLetter(tiles, "A");

        expect(tiles[1].line).toBe(0);
        expect(tiles[0].line).toBeUndefined();
    });

    it("refuses a typed letter when there's neither it nor a blank", () => {
        const tiles = board("_");

        type(tiles, "AB");

        expect(typeLetter(tiles, "C")).toBeNull();
        expect(spellText(tiles)).toBe("A");
    });

    it("shows a tapped blank as an underscore until it has a letter", () => {
        const tiles = board("_");

        addToSpell(tiles, "_");

        expect(spellText(tiles)).toBe("_");
    });

    it("uses tiles that aren't kept first", () => {
        const tiles = board("NN");

        setKept(tiles, "N", true);

        const used = addToSpell(tiles, "N");

        expect(used.kept).toBeUndefined();
        expect(tray(tiles)).toEqual(["N1k"]);
    });

    it("can use a kept tile when asked to, or when it's the only one", () => {
        const tiles = board("NN");

        setKept(tiles, "N", true);

        expect(addToSpell(tiles, "N", { kept: true }).kept).toBe(true);
        expect(addToSpell(tiles, "N").kept).toBeUndefined();

        const single = board("Q");

        setKept(single, "Q", true);

        expect(addToSpell(single, "Q").kept).toBe(true);
    });
});

describe("taking tiles back", () => {
    it("closes the gap a letter leaves", () => {
        const tiles = board("CATS");

        type(tiles, "CATS");
        removeFromSpell(tiles, tiles[1]);

        expect(spellText(tiles)).toBe("CTS");
    });

    it("joins nothing when a whole word goes", () => {
        const tiles = board("ABCD");

        type(tiles, "AB C D");
        removeFromSpell(tiles, tiles[2]);

        expect(spellText(tiles)).toBe("AB D");
    });

    it("forgets the letter a blank stood for", () => {
        const tiles = board("_");

        typeLetter(tiles, "Z");
        removeFromSpell(tiles, tiles[0]);

        expect(tiles[0].as).toBeUndefined();
        expect(tiles[0].line).toBeUndefined();
        expect(tray(tiles)).toEqual(["_1"]);
    });

    it("takes back the last letter, and copes with an empty spell", () => {
        const tiles = board("AB");

        type(tiles, "AB");

        expect(removeLastFromSpell(tiles).letter).toBe("B");
        expect(removeLastFromSpell(tiles).letter).toBe("A");
        expect(removeLastFromSpell(tiles)).toBeNull();
    });

    it("knows when the last letter is all that's left of a word after another", () => {
        const tiles = board("ABC");

        expect(lastLetterIsWholeWord(tiles)).toBe(false);

        addToSpell(tiles, "A");
        expect(lastLetterIsWholeWord(tiles)).toBe(false);

        addToSpell(tiles, "B", { newWord: true });
        expect(lastLetterIsWholeWord(tiles)).toBe(true);

        addToSpell(tiles, "C");
        expect(lastLetterIsWholeWord(tiles)).toBe(false);
    });

    it("sends the whole spell back with a reset", () => {
        const tiles = board("A_");

        type(tiles, "AZ");
        resetSpell(tiles);

        expect(spellText(tiles)).toBe("");
        expect(tray(tiles)).toEqual(["A1", "_1"]);
    });
});

describe("keeping and returning tiles", () => {
    it("keeps one tile at a time, and lets go of one at a time", () => {
        const tiles = board("NNN");

        setKept(tiles, "N", true);
        setKept(tiles, "N", true);
        expect(tray(tiles)).toEqual(["N1", "N2k"]);

        setKept(tiles, "N", false);
        expect(tray(tiles)).toEqual(["N2", "N1k"]);
    });

    it("has nothing to keep when there's none in the tray", () => {
        expect(setKept(board("A"), "B", true)).toBeNull();
    });

    it("returns one tile from the right group", () => {
        const tiles = board("NN");

        setKept(tiles, "N", true);

        removeFromTray(tiles, "N", true);

        expect(tray(tiles)).toEqual(["N1"]);
        expect(removeFromTray(tiles, "N", true)).toBeNull();
    });

    it("clearing the board leaves only kept tiles, back in the tray", () => {
        const tiles = board("ABC");

        setKept(tiles, "A", true);
        type(tiles, "AB");

        expect(tray(clearedBoard(tiles))).toEqual(["A1k"]);
    });
});

describe("on a desktop", () => {
    const zone = { left: 900, right: 1200, top: 500, bottom: 700 };
    const area = { left: 400, top: 60, width: 400 };
    const size = 48;

    it("leaves a normal board alone", () => {
        expect(needsDesktopLayout(board("AB"), zone, size)).toBe(false);
    });

    it("notices a spell, a blank's letter, and a kept tile out of the safe zone", () => {
        const spelled = board("A");
        const kept = board("A");

        type(spelled, "A");
        setKept(kept, "A", true);

        expect(needsDesktopLayout(spelled, zone, size)).toBe(true);
        expect(needsDesktopLayout(kept, zone, size)).toBe(true);
    });

    it("leaves a kept tile alone that's already in the safe zone", () => {
        const tiles = [{ letter: "A", x: 1000, y: 600, kept: true }];

        expect(needsDesktopLayout(tiles, zone, size)).toBe(false);
    });

    it("turns the spell into a row the desktop reads as the same words", () => {
        const tiles = board("EMBERRAIN");

        type(tiles, "EMBER RAIN");
        layOutForDesktop(tiles, { ...area, width: 1000 }, zone, size);

        const { words } = findWords(tiles.map(tile => ({ letter: tile.letter, x: tile.x + size / 2, y: tile.y + size / 2 })), size);

        expect(words.map(word => word.text)).toEqual(["EMBER", "RAIN"]);
        expect(tiles.every(tile => tile.line === undefined)).toBe(true);
        expect(needsDesktopLayout(tiles, zone, size)).toBe(false);
    });

    it("puts a word on a new row when it doesn't fit", () => {
        const tiles = board("EMBERRAIN");

        type(tiles, "EMBER RAIN");
        layOutForDesktop(tiles, { ...area, width: 300 }, zone, size);

        expect(tiles[5].y).toBeGreaterThan(tiles[0].y);
        expect(tiles[5].x).toBe(area.left);
    });

    it("puts kept tiles in the safe zone and forgets a blank's letter", () => {
        const tiles = board("A_");

        setKept(tiles, "A", true);
        typeLetter(tiles, "Z");
        layOutForDesktop(tiles, area, zone, size);

        expect(needsDesktopLayout(tiles, zone, size)).toBe(false);
        expect(tiles[0].x).toBeGreaterThanOrEqual(zone.left);
        expect(tiles[1].as).toBeUndefined();
    });
});
