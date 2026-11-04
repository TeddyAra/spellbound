import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    state,
    commit,
    loadState,
    undo,
    undoLabel,
    saveWithoutUndo,
    addLog,
    clearLog,
    listCharacters,
    addCharacter,
    switchCharacter,
    deleteCharacter,
    exportCharacter,
    readCharacterFile,
    exportDue,
    markExported,
    exportedWhen,
    normalizeBoard,
    normalizeAction,
    rank,
    rankPointsLeft,
    calculatedMaxHealth
} from "../src/state.js";

const DAY = 24 * 60 * 60 * 1000;

const tile = (letter, x = 100) => ({ letter, x, y: 200, rotation: 3, z: 25 });

beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    loadState();
    commit();
});

/* Past the window in which unnamed changes merge into one step. */
function later() {
    vi.useFakeTimers({ now: Date.now() + 5000 });
}

describe("undo", () => {
    it("takes back a named change", () => {
        state.currentHealth = 5;
        commit("Took 7 damage");

        expect(undoLabel()).toBe("Took 7 damage");
        expect(undo()).toBe("Took 7 damage");
        expect(state.currentHealth).toBe(12);
        expect(undoLabel()).toBeNull();
    });

    it("has nothing to undo after a commit that changed nothing", () => {
        commit("Nothing");

        expect(undoLabel()).toBeNull();
        expect(undo()).toBeNull();
    });

    it("merges quick unnamed changes, such as typing a name, into one step", () => {
        for (const name of ["T", "Ta", "Tam"]) {
            state.name = name;
            commit();
        }

        undo();

        expect(state.name).toBe("");
    });

    it("keeps unnamed changes further apart as separate steps", () => {
        state.name = "Tam";
        commit();

        later();

        state.name = "Tamsin";
        commit();

        undo();

        expect(state.name).toBe("Tam");
    });

    it("keeps named changes separate, however quick", () => {
        state.currentHealth = 8;
        commit("First");

        state.currentHealth = 4;
        commit("Second");

        undo();

        expect(state.currentHealth).toBe(8);
    });

    it("makes one step of a merged change", () => {
        state.shortRests = 1;
        commit("Short rest");

        later();

        state.construct.name = "Cog";
        commit("Short rest", { merge: true });

        undo();

        expect(state.shortRests).toBe(0);
        expect(state.construct.name).toBe("");
    });

    it("doesn't make moving a tile or opening the panel a step of its own", () => {
        state.board = [tile("A")];
        commit("Got 1 tile");

        state.board = [tile("A", 300)];
        saveWithoutUndo();

        state.action = { mode: "spell", school: "harm", level: 1, split: [1] };
        commit();

        expect(undoLabel()).toBe("Got 1 tile");
    });

    it("leaves tiles where they are when undoing something else", () => {
        state.board = [tile("A")];
        commit("Got 1 tile");

        state.currentHealth = 3;
        commit("Took 9 damage");

        state.board = [tile("A", 300)];
        saveWithoutUndo();

        undo();

        expect(state.currentHealth).toBe(12);
        expect(state.board[0].x).toBe(300);
    });

    it("brings back the tiles and panel when undoing Clear Board, in their latest places", () => {
        state.board = [tile("A")];
        state.action = { mode: "spell", school: "harm", level: 2, split: [2] };
        commit("Got 1 tile");

        state.board = [tile("A", 300)];
        saveWithoutUndo();

        state.board = [];
        state.action = null;
        commit("Cleared the board");

        undo();

        expect(state.board).toEqual([tile("A", 300)]);
        expect(state.action.level).toBe(2);
    });

    it("never takes anything out of the log, and notes the undo in it", () => {
        state.currentHealth = 5;
        commit("Took 7 damage");
        addLog("Damage", "Took 7");

        undo();

        expect(state.log.map(entry => entry.title)).toEqual(["Undid", "Damage"]);
    });

    it("forgets the steps when switching character", () => {
        state.currentHealth = 5;
        commit("Took 7 damage");

        addCharacter();

        expect(undoLabel()).toBeNull();
    });
});

describe("saving the board", () => {
    it("keeps the tiles and panel over a reload", () => {
        state.board = [tile("A"), tile("_", 160)];
        state.action = { mode: "weapon", school: "harm", level: 2, highest: 5, split: [2] };
        commit();

        loadState();

        expect(state.board).toEqual([tile("A"), tile("_", 160)]);
        expect(state.action.mode).toBe("weapon");
    });

    it("drops tiles that make no sense", () => {
        expect(normalizeBoard([tile("A"), { letter: "ab", x: 1, y: 1 }, { letter: "B", x: "1", y: 1 }, null])).toEqual([tile("A")]);
        expect(normalizeBoard("nonsense")).toEqual([]);
    });

    it("drops a panel that makes no sense, and repairs a wrong split", () => {
        expect(normalizeAction({ mode: "nonsense", level: 1 })).toBeNull();
        expect(normalizeAction({ mode: "spell", level: 0 })).toBeNull();
        expect(normalizeAction(null)).toBeNull();
        expect(normalizeAction({ mode: "spell", school: "harm", level: 3, split: [2, 2] }).split).toEqual([3]);
        expect(normalizeAction({ mode: "spell", school: "harm", level: 3, split: [2, 1] }).split).toEqual([2, 1]);
    });
});

describe("the log", () => {
    it("adds the newest first, and survives a reload", () => {
        addLog("First");
        addLog("Second", "Details", [3, 5]);

        loadState();

        expect(state.log[0]).toMatchObject({ title: "Second", detail: "Details", dice: [3, 5] });
        expect(state.log[1].title).toBe("First");
    });

    it("keeps only the newest 200", () => {
        for (let i = 0; i < 205; i++) {
            addLog(`Roll ${i}`);
        }

        expect(state.log).toHaveLength(200);
        expect(state.log[0].title).toBe("Roll 204");
    });

    it("isn't an undo step, and can be cleared", () => {
        addLog("Roll");
        commit();

        expect(undoLabel()).toBeNull();

        clearLog();

        expect(state.log).toEqual([]);
    });
});

describe("several characters", () => {
    it("starts with one, and keeps each one's own data", () => {
        state.name = "Tamsin";
        state.board = [tile("A")];
        commit();

        const first = listCharacters()[0].id;

        addCharacter();

        expect(state.name).toBe("");
        expect(state.board).toEqual([]);
        expect(listCharacters()).toHaveLength(2);

        state.name = "Bram";
        commit();

        switchCharacter(first);

        expect(state.name).toBe("Tamsin");
        expect(state.board).toEqual([tile("A")]);
    });

    it("remembers the current character over a reload", () => {
        addCharacter();
        state.name = "Bram";
        commit();

        loadState();

        expect(state.name).toBe("Bram");
        expect(listCharacters()).toHaveLength(2);
    });

    it("moves a save from before there were several characters, and leaves it as a backup", () => {
        localStorage.clear();

        const old = JSON.stringify({ name: "Veteran", className: "warden", level: 3 });

        localStorage.setItem("spellboundState", old);

        loadState();

        expect(state.name).toBe("Veteran");
        expect(state.className).toBe("warden");
        expect(listCharacters()).toHaveLength(1);
        expect(localStorage.getItem("spellboundState")).toBe(old);

        // The old save isn't read again once it's been moved
        state.name = "Renamed";
        commit();
        loadState();

        expect(state.name).toBe("Renamed");
    });

    it("switches to another character when the current one is deleted", () => {
        state.name = "Tamsin";
        commit();

        const first = listCharacters()[0].id;

        addCharacter();

        const second = listCharacters()[1].id;

        deleteCharacter(second);

        expect(state.name).toBe("Tamsin");
        expect(listCharacters().map(character => character.id)).toEqual([first]);
    });

    it("leaves a blank character after deleting the last one, without bringing the old one back", () => {
        state.name = "Tamsin";
        commit();

        const only = listCharacters()[0].id;

        deleteCharacter(only);

        expect(state.name).toBe("");
        expect(listCharacters()).toHaveLength(1);
        expect(localStorage.getItem(`spellboundCharacter:${only}`)).toBeNull();
    });

    it("deletes a character that isn't the current one", () => {
        const first = listCharacters()[0].id;

        addCharacter();
        state.name = "Bram";
        commit();

        deleteCharacter(first);

        expect(state.name).toBe("Bram");
        expect(listCharacters()).toHaveLength(1);
    });

    it("imports a file as a new character, leaving the current one alone", () => {
        state.name = "Tamsin";
        commit();

        const file = exportCharacter();

        state.name = "Changed";
        commit();

        addCharacter(readCharacterFile(file));

        expect(state.name).toBe("Tamsin");
        expect(listCharacters().map(character => character.name)).toEqual(["Changed", "Tamsin"]);
    });

    it("refuses a file that isn't a character", () => {
        expect(() => readCharacterFile("not json")).toThrow();
        expect(() => readCharacterFile(JSON.stringify({ format: "other" }))).toThrow();
    });
});

describe("the export reminder", () => {
    const now = () => Date.now();

    it("stays quiet for a new character nobody changed", () => {
        expect(exportDue(state, now() + 30 * DAY)).toBe(false);
    });

    it("waits a week after creation, then reminds about changes", () => {
        state.currentHealth = 5;
        commit("Damage");

        expect(exportDue(state, now() + 6 * DAY)).toBe(false);
        expect(exportDue(state, now() + 8 * DAY)).toBe(true);
    });

    it("stops after an export, until there's a new change a week on", () => {
        state.currentHealth = 5;
        commit("Damage");

        vi.useFakeTimers({ now: now() + 10 });
        state.lastExported = now();
        commit();

        expect(exportDue(state, now() + 30 * DAY)).toBe(false);

        vi.useFakeTimers({ now: now() + 10 });
        state.currentHealth = 6;
        commit("Healed");

        expect(exportDue(state, now() + 6 * DAY)).toBe(false);
        expect(exportDue(state, now() + 8 * DAY)).toBe(true);
    });

    it("doesn't count tile moves or the log as changes", () => {
        state.board = [tile("A", 300)];
        saveWithoutUndo();
        addLog("Roll");
        commit();

        expect(state.changedAt).toBe(0);
    });

    it("exports and marks a character that isn't the current one", () => {
        state.name = "Tamsin";
        commit();

        const first = listCharacters()[0].id;

        addCharacter();
        markExported(first);

        expect(JSON.parse(exportCharacter(first)).character.name).toBe("Tamsin");
        expect(listCharacters()[0].lastExported).toBeGreaterThan(0);
        expect(state.lastExported).toBe(0);
    });

    it("flags another character whose backup is due", () => {
        state.name = "Tamsin";
        commit();

        vi.useFakeTimers({ now: Date.now() + 8 * DAY });
        addCharacter();

        expect(listCharacters().map(character => character.exportDue)).toEqual([true, false]);
    });

    it("says when in plain words", () => {
        const today = 1_000_000_000_000;

        expect(exportedWhen(0, today)).toBe("never");
        expect(exportedWhen(today - 1000, today)).toBe("today");
        expect(exportedWhen(today - DAY, today)).toBe("yesterday");
        expect(exportedWhen(today - 3 * DAY, today)).toBe("3 days ago");
    });
});

describe("the rules", () => {
    it("works out passion from the highest rank, and spends rank points", () => {
        const before = rankPointsLeft();

        state.rankPoints.harm = 2;
        commit();

        expect(rank("harm")).toBe(3);
        expect(rank("passion")).toBe(5);
        expect(rankPointsLeft()).toBe(before - 2);
    });

    it("keeps a character at full health at full health when max HP goes up", () => {
        state.level = 3;
        commit();

        expect(state.maxHealth).toBe(calculatedMaxHealth());
        expect(state.currentHealth).toBe(state.maxHealth);
    });

    it("repairs values out of range", () => {
        state.level = 99;
        state.currentHealth = -5;
        commit();

        expect(state.level).toBe(12);
        expect(state.currentHealth).toBe(0);
    });
});
