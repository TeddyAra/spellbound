import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLASSES } from "../src/rules.js";
import { migrateFeats } from "../src/state.js";

const RULEBOOK = readFileSync(resolve(import.meta.dirname, "../rulebook.md"), "utf8").replace(/\r\n/g, "\n");

/* The feats in a class's "### <Class> Feats" list, as { name, minLevel }. Sub-bullets are skipped. */
function rulebookFeats(className) {
    const start = RULEBOOK.indexOf(`### ${className} Feats\n`);
    const end = RULEBOOK.indexOf("\n### ", start + 1);

    return [...RULEBOOK.slice(start, end).matchAll(/^- \*\*(.+?)(?: \((\d+)\+\))?\.\*\*/gm)]
        .map(([, name, level]) => ({ name, minLevel: level ? Number(level) : undefined }));
}

describe("class feats", () => {
    for (const { name, feats } of Object.values(CLASSES)) {
        it(`${name} has the same feats, levels and order as the rulebook`, () => {
            const app = feats.map(feat => ({ name: feat.name, minLevel: feat.minLevel }));

            expect(app).toEqual(rulebookFeats(name));
        });
    }

    it("gives every feat a unique key", () => {
        const keys = Object.values(CLASSES).flatMap(({ feats }) => feats.map(feat => feat.key));

        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe("saved feats from older versions", () => {
    it("turns Dirty Fighting into Dirty Tricks", () => {
        expect(migrateFeats({ dirtyFighting: 1, lightFingers: 1 })).toEqual({ dirtyTricks: 1, lightFingers: 1 });
    });

    it("leaves current feats alone", () => {
        expect(migrateFeats({ dirtyTricks: 1 })).toEqual({ dirtyTricks: 1 });
        expect(migrateFeats(undefined)).toEqual({});
    });
});
