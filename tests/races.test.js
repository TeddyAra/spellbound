import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RACES, TONGUES } from "../src/rules.js";
import {
    state,
    commit,
    loadState,
    mortalLimit,
    weaponMortalLimit,
    mortalLimitSources,
    calculatedMaxHealth,
    effectiveArmor,
    allowedWeaponDice
} from "../src/state.js";

const RULEBOOK = readFileSync(resolve(import.meta.dirname, "../rulebook.md"), "utf8").replace(/\r\n/g, "\n");

/* The rows of the "Races" table in the Races chapter. */
function rulebookTable() {
    const start = RULEBOOK.indexOf("##### Races\n");
    const lines = RULEBOOK.slice(start).split("\n").slice(2);
    const rows = lines.slice(0, lines.findIndex(line => !line.startsWith("|"))).slice(2);

    return rows.map(row => {
        const [name, size, speed, darkvision, hitPoints] = row.split("|").slice(1, -1).map(cell => cell.trim());

        return {
            name,
            size,
            speed: parseInt(speed, 10),
            darkvision: darkvision === "Yes",
            hpPerLevel: hitPoints === "—" ? 0 : parseInt(hitPoints, 10)
        };
    });
}

beforeEach(() => {
    localStorage.clear();
    loadState();
    commit();
});

describe("the races in the rulebook", () => {
    it("match the app's races, in the same order", () => {
        const app = Object.values(RACES).map(({ name, size, speed, darkvision, hpPerLevel }) => ({ name, size, speed, darkvision, hpPerLevel }));

        expect(app).toEqual(rulebookTable());
    });

    it("each suggest a Tongue that exists, the same as their rulebook entry", () => {
        for (const race of Object.values(RACES)) {
            const tongue = TONGUES[race.tongue];

            expect(tongue).toBeDefined();
            expect(RULEBOOK).toContain(`### ${race.name}\n`);
            expect(RULEBOOK.slice(RULEBOOK.indexOf(`### ${race.name}\n`))).toMatch(new RegExp(`Usually ${tongue.name}\\.`));
        }
    });
});

describe("choosing a race", () => {
    it("starts with no race, and forgets one that doesn't exist", () => {
        expect(state.race).toBe("");

        state.race = "fairy";
        commit();

        expect(state.race).toBe("");
    });

    it("gives a human one knack school to choose, and other races none", () => {
        state.race = "human";
        commit();
        expect(state.knackSchools).toEqual([""]);

        state.race = "elf";
        commit();
        expect(state.knackSchools).toEqual([]);
    });
});

describe("knacks", () => {
    it("raise a human's whole chosen school by 1, weapon attacks too for Harm", () => {
        state.race = "human";
        state.knackSchools = ["harm"];
        commit();

        expect(mortalLimit("harm")).toBe(4);
        expect(mortalLimit("move")).toBe(3);
        expect(weaponMortalLimit()).toBe(4);
        expect(mortalLimitSources("harm")).toContain("Human knack: +1");
    });

    it("only raise other races' limit when the action fits the knack", () => {
        state.race = "halfling";
        commit();

        expect(mortalLimit("move")).toBe(3);
        expect(mortalLimit("move", false, true)).toBe(4);
        expect(mortalLimit("control", false, true)).toBe(3);
    });

    it("add up with class features, up to 5", () => {
        state.className = "golemwright";
        state.race = "dwarf";
        commit();

        // Handy sets 4, the knack makes it 5
        expect(mortalLimit("create")).toBe(4);
        expect(mortalLimit("create", false, true)).toBe(5);

        state.className = "warden";
        state.level = 6;
        state.race = "human";
        state.knackSchools = ["aid"];
        commit();

        // Aegis is already 5
        expect(mortalLimit("aid")).toBe(5);
    });
});

describe("racial traits", () => {
    it("add hit points at every level", () => {
        state.className = "wordweaver";
        state.level = 3;
        commit();

        const without = calculatedMaxHealth();

        state.race = "orc";
        commit();

        expect(calculatedMaxHealth()).toBe(without + 3);
        expect(state.maxHealth).toBe(without + 3);
    });

    it("give dragonkin 1 armor, but only without armor", () => {
        state.className = "warden";
        state.race = "dragonkin";
        state.armor = 0;
        state.shield = false;
        commit();

        expect(effectiveArmor()).toBe(1);

        state.armor = 2;
        commit();

        expect(effectiveArmor()).toBe(2);
    });

    it("keep heavy weapons from Small races", () => {
        state.className = "spellblade";
        commit();
        expect(allowedWeaponDice()).toContain(10);

        state.race = "gnome";
        commit();
        expect(allowedWeaponDice()).not.toContain(10);
    });
});
