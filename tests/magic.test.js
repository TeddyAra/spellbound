import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    state,
    commit,
    loadState,
    newWeapon,
    effectiveArmor,
    weaponGuardReduction,
    weaponBonusPrefix
} from "../src/state.js";

const RULEBOOK = readFileSync(resolve(import.meta.dirname, "../rulebook.md"), "utf8").replace(/\r\n/g, "\n");

beforeEach(() => {
    localStorage.clear();
    loadState();
    commit();
});

describe("magic weapons", () => {
    it("keep a bonus from +0 to +3, and old weapons have none", () => {
        expect(newWeapon({ name: "Sword", die: 8 }).bonus).toBe(0);
        expect(newWeapon({ die: 8, bonus: "2" }).bonus).toBe(2);
        expect(newWeapon({ die: 8, bonus: 7 }).bonus).toBe(3);
        expect(newWeapon({ die: 8, bonus: -1 }).bonus).toBe(0);
    });

    it("survive a save", () => {
        state.weapons.push(newWeapon({ name: "Flametongue", die: 8, bonus: 2 }));
        commit();
        loadState();

        expect(state.weapons.at(-1).bonus).toBe(2);
    });

    it("lower the target's Guard DC from +2, as in the rulebook's table", () => {
        const rows = RULEBOOK.slice(RULEBOOK.indexOf("#### Magic Weapons and Armor")).split("\n").filter(line => /^\| \+\d/.test(line));

        expect(rows).toHaveLength(3);

        for (const row of rows) {
            const bonus = parseInt(row.slice(3), 10);

            expect(row).toContain(`+${bonus} damage`);
            expect(row.includes("Guard DC 1 lower")).toBe(weaponGuardReduction({ bonus }) === 1);
        }
    });

    it("show their bonus before the name", () => {
        expect(weaponBonusPrefix({ bonus: 3 })).toBe("+3 ");
        expect(weaponBonusPrefix({ bonus: 0 })).toBe("");
    });
});

describe("magic armor and shields", () => {
    it("add 1 each, but only while worn", () => {
        state.className = "warden";
        state.armor = 3;
        state.shield = true;
        state.magicArmor = true;
        state.magicShield = true;
        commit();

        expect(effectiveArmor()).toBe(6);

        state.shield = false;
        commit();
        expect(effectiveArmor()).toBe(4);

        state.armor = 0;
        commit();
        expect(effectiveArmor()).toBe(0);
    });
});
