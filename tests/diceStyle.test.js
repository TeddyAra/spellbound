import { beforeEach, describe, expect, it } from "vitest";
import { DICE_FINISHES, loadDiceStyle, saveDiceStyle } from "../src/diceStyle.js";

describe("the dice's look", () => {
    beforeEach(() => localStorage.clear());

    it("starts out blue and cartoon", () => {
        expect(loadDiceStyle()).toMatchObject({ color: "#1d66af", finish: "cartoon" });
        expect(DICE_FINISHES[loadDiceStyle().finish].name).toBe("Cartoon");
    });

    it("keeps what the player chose", () => {
        saveDiceStyle({ ...loadDiceStyle(), color: "random", finish: "metal" });

        expect(loadDiceStyle()).toMatchObject({ color: "random", finish: "metal" });
    });

    it("goes back to the default for a finish that was taken out", () => {
        saveDiceStyle({ ...loadDiceStyle(), color: "#ff6600", finish: "glitter" });

        expect(loadDiceStyle()).toMatchObject({ color: "#ff6600", finish: "cartoon" });
    });
});
