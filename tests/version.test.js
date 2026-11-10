import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHANGELOG, VERSION, formatDate } from "../src/version.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

describe("version and changelog", () => {
    it("takes the version from the newest entry", () => {
        expect(VERSION).toBe(CHANGELOG[0].version);
    });

    it("lists versions newest first, each once, with a date and changes", () => {
        const numbers = CHANGELOG.map(entry => entry.version.split(".").map(Number));

        for (let i = 1; i < numbers.length; i++) {
            const [newer, older] = [numbers[i - 1], numbers[i]];
            expect(newer[0] > older[0] || (newer[0] === older[0] && newer[1] > older[1])).toBe(true);
        }

        for (const entry of CHANGELOG) {
            expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(entry.changes.length).toBeGreaterThan(0);
        }
    });

    it("dates entries no earlier than the one before", () => {
        const dates = CHANGELOG.map(entry => entry.date);
        expect([...dates].sort().reverse()).toEqual(dates);
    });

    it("matches package.json", () => {
        expect(JSON.parse(read("../package.json")).version).toBe(`${VERSION}.0`);
    });

    it("isn't ahead of the rulebook", () => {
        expect(read("../rulebook.md")).toContain(`### Version ${VERSION}`);
    });

    it("writes dates out in full, on the right day", () => {
        expect(formatDate("2026-11-10")).toBe("10 November 2026");
        expect(formatDate("2027-01-01")).toBe("1 January 2027");
    });
});
