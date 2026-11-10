import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    buildIndex,
    parseBlocks,
    parseInline,
    parseRulebook,
    queryTokens,
    rulebookVersion,
    search,
    snippet,
    stem,
    suggestions,
    slug,
    DM_CHAPTERS,
    LEFT_OUT,
    DEFAULT_SUGGESTIONS
} from "../src/rulebook.js";
import { GLOSSARY } from "../src/glossary.js";
import { VERSION } from "../src/version.js";

const RULEBOOK = readFileSync(resolve(import.meta.dirname, "../rulebook.md"), "utf8");
const index = buildIndex(RULEBOOK, GLOSSARY);

const titles = results => results.map(({ entry }) => entry.term ?? entry.path.join(" › "));
const chapters = new Set(index.sections.map(section => section.chapter));
const allChapters = [...RULEBOOK.matchAll(/^## (.+)$/gm)].map(match => match[1].trim());

describe("reading the rulebook", () => {
    it("finds the version on the cover, the same as the app's", () => {
        expect(rulebookVersion(RULEBOOK)).toBe(VERSION);
        expect(index.version).toBe(VERSION);
    });

    it("names DM chapters, left-out chapters and suggestions that exist, so renaming one fails here", () => {
        for (const chapter of [...DM_CHAPTERS, ...LEFT_OUT]) {
            expect(allChapters).toContain(chapter);
        }

        const ids = new Set(index.sections.map(section => section.id));

        for (const path of DEFAULT_SUGGESTIONS) {
            expect(ids).toContain(path.map(slug).join("/"));
        }
    });

    it("leaves out the glossary, character sheet and changes", () => {
        for (const chapter of LEFT_OUT) {
            expect(chapters.has(chapter)).toBe(false);
        }
    });

    it("splits chapters into their subsections and parts, with unique ids", () => {
        const volume = index.sections.find(section => section.id === "spellcasting/speaking-your-spell/volume");

        expect(volume.path).toEqual(["Spellcasting", "Speaking Your Spell", "Volume"]);
        expect(new Set(index.sections.map(section => section.id)).size).toBe(index.sections.length);
    });

    it("drops the page layout but keeps notes and stat blocks", () => {
        const text = index.sections.map(section => section.text).join("\n");

        expect(text).not.toMatch(/\\page|\\column|\{\{|\}\}|<div|&nbsp;/);

        const goblin = index.sections.find(section => section.chapter === "Goblin Skirmisher");

        expect(goblin.dm).toBe(true);
        expect(goblin.blocks[0]).toMatchObject({ type: "box", kind: "monster" });
        expect(goblin.text).toContain("Hit Points: 9");
    });

    it("leaves the cover's small print out", () => {
        expect(index.sections.some(section => section.text.includes("playtest edition"))).toBe(false);
    });
});

describe("markdown", () => {
    it("reads bold, italics, both, and links", () => {
        expect(parseInline("Roll **3d6** and *hope*")).toEqual([
            { text: "Roll ", bold: false, italic: false },
            { text: "3d6", bold: true, italic: false },
            { text: " and ", bold: false, italic: false },
            { text: "hope", bold: false, italic: true }
        ]);

        expect(parseInline("***Sneaky.*** Hides")[0]).toEqual({ text: "Sneaky.", bold: true, italic: true });
        expect(parseInline("the [dashboard](https://example.com/)")[1]).toMatchObject({ text: "dashboard", href: "https://example.com/" });
    });

    it("reads paragraphs, lists, tables and boxes", () => {
        const blocks = parseBlocks([
            "One line",
            "and the next.",
            "",
            "- first",
            "- second",
            "",
            "| Rank | Pool |",
            "|:--- |:--- |",
            "| 1 | 1d6 |",
            "{{note",
            "##### Inside",
            "Text",
            "}}"
        ]);

        expect(blocks.map(block => block.type)).toEqual(["paragraph", "list", "table", "box"]);
        expect(blocks[0].inlines.map(part => part.text).join("")).toBe("One line and the next.");
        expect(blocks[1].items).toHaveLength(2);
        expect(blocks[2].rows).toHaveLength(1);
        expect(blocks[3].children.map(block => block.type)).toEqual(["heading", "paragraph"]);
    });
});

describe("searching", () => {
    it("counts plurals as the word", () => {
        expect(stem("surges")).toBe("surge");
        expect(stem("abilities")).toBe("ability");
        expect(stem("class")).toBe("class");
        expect(queryTokens("How do surges work")).toEqual(["surge", "work"]);
    });

    it("puts the section about a rule near the top", () => {
        expect(titles(search(index, "surges")).slice(0, 2)).toContain("Rolling the Dice › Reading Your Roll");
        expect(titles(search(index, "volume")).slice(0, 3)).toContain("Spellcasting › Speaking Your Spell › Volume");
        expect(titles(search(index, "resting"))[0]).toBe("Health and Resting › Resting");
        expect(titles(search(index, "tongue perks"))[0]).toBe("Spellcasting › Tongues › Tongue Perks");
    });

    it("finds glossary terms", () => {
        expect(titles(search(index, "stabilize"))[0]).toBe("Stabilize");
    });

    it("needs every word", () => {
        expect(search(index, "volume zzzz")).toEqual([]);
    });

    it("finds partial words", () => {
        expect(titles(search(index, "opportun"))).toContain("Opportunity attack");
    });

    it("only searches the DM chapters when asked to", () => {
        const dmChapter = ({ entry }) => entry.dm;

        expect(search(index, "goblin").some(dmChapter)).toBe(false);
        expect(search(index, "goblin", { dm: true }).some(dmChapter)).toBe(true);
    });

    it("finds nothing for nothing", () => {
        expect(search(index, "   ")).toEqual([]);
    });
});

describe("snippets", () => {
    const text = "A long introduction that goes on for a while before it gets anywhere. Every die that rolled a 5 or higher is called a surge, and it adds a level.";

    it("shows the text around the first match, marked", () => {
        const piece = snippet(text, queryTokens("surge"), 80);
        const [start, end] = piece.ranges[0];

        expect(piece.text.slice(start, end)).toBe("surge");
        expect(piece.before).toBe(true);
    });

    it("starts at the beginning when that's where the match is", () => {
        expect(snippet(text, queryTokens("introduction")).before).toBe(false);
    });
});

describe("suggestions", () => {
    it("starts with the defaults", () => {
        expect(suggestions({}, index.sections).map(section => section.id)[0]).toBe("rolling-the-dice/reading-your-roll");
    });

    it("puts what you open most first, without repeats", () => {
        const ids = suggestions({ "spellcasting/bending-the-rules": 5, "health-and-resting/wards": 2 }, index.sections).map(section => section.id);

        expect(ids.slice(0, 2)).toEqual(["spellcasting/bending-the-rules", "health-and-resting/wards"]);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(8);
    });

    it("skips sections that are gone, and DM chapters unless they're on", () => {
        const goblin = index.sections.find(section => section.chapter === "Goblin Skirmisher").id;
        const history = { "no/such/section": 9, [goblin]: 3 };

        expect(suggestions(history, index.sections).map(section => section.id)).not.toContain(goblin);
        expect(suggestions(history, index.sections, { dm: true })[0].id).toBe(goblin);
    });
});

describe("the rulebook as a whole", () => {
    it("has text in every section", () => {
        expect(parseRulebook(RULEBOOK).every(section => section.text.trim())).toBe(true);
    });
});
