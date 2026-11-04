import { describe, expect, it } from "vitest";
import { findWords } from "../src/words.js";

const SIZE = 48;

const row = (text, y = 100, startX = 100) => [...text].map((letter, index) => ({ letter, x: startX + index * SIZE, y }));

describe("findWords", () => {
    it("reads tiles in a row, left to right", () => {
        expect(findWords(row("CAT"), SIZE).words.map(word => word.text)).toEqual(["CAT"]);
    });

    it("reads words top to bottom", () => {
        const { words } = findWords([...row("LOW", 300), ...row("TOP", 100)], SIZE);

        expect(words.map(word => word.text)).toEqual(["TOP", "LOW"]);
    });

    it("leaves tiles with a gap between them loose", () => {
        const { words, loose } = findWords([{ letter: "A", x: 100, y: 100 }, { letter: "B", x: 300, y: 100 }], SIZE);

        expect(words).toEqual([]);
        expect(loose).toEqual(["A", "B"]);
    });
});
