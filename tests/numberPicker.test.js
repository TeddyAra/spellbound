import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addNumberPicker, closeNumberList, listPlacement } from "../src/numberPicker.js";

describe("where the list opens", () => {
    it("goes below the box when it fits", () => {
        expect(listPlacement({ top: 100, bottom: 140 }, 240, 800)).toEqual({ top: 144, height: 240 });
    });

    it("goes above when it only fits there", () => {
        expect(listPlacement({ top: 600, bottom: 640 }, 240, 700)).toEqual({ top: 356, height: 240 });
    });

    it("shrinks to the bigger side when it fits on neither", () => {
        expect(listPlacement({ top: 100, bottom: 140 }, 500, 400)).toEqual({ top: 144, height: 248 });
    });
});

describe("the number list", () => {
    let input;

    const options = () => [...document.querySelectorAll(".number-list [role=option]")];
    const open = () => document.querySelector(".number-picker-button").click();

    beforeEach(() => {
        document.body.innerHTML = `<div id="box"><input id="amount" type="number" value="3"></div>`;
        input = document.getElementById("amount");

        addNumberPicker(input, { min: 1, max: 10 });
    });

    afterEach(closeNumberList);

    it("lists the numbers and marks the current one", () => {
        open();

        expect(options().map(option => option.textContent)).toHaveLength(10);
        expect(options()[0].textContent).toBe("1");
        expect(document.querySelector(".number-list .selected").textContent).toBe("3");
    });

    it("can start at 0, for wards", () => {
        document.body.innerHTML = `<input id="ward" type="number" value="0">`;

        addNumberPicker(document.getElementById("ward"), { min: 0, max: 5 });
        open();

        expect(options()[0].textContent).toBe("0");
    });

    it("goes up to 100 by default", () => {
        document.body.innerHTML = `<input id="count" type="number" value="1">`;

        addNumberPicker(document.getElementById("count"));
        open();

        expect(options()).toHaveLength(100);
    });

    it("follows the input's own max, as it is when opened", () => {
        document.body.innerHTML = `<input id="level" type="number" value="1" max="3">`;

        const level = document.getElementById("level");

        addNumberPicker(level);

        open();
        expect(options()).toHaveLength(3);
        closeNumberList();

        level.max = 5;

        open();
        expect(options()).toHaveLength(5);
    });

    it("picking counts as typing, and closes the list", () => {
        const heard = [];

        input.addEventListener("input", () => heard.push(input.value));

        open();
        options()[6].click();

        expect(input.value).toBe("7");
        expect(heard).toEqual(["7"]);
        expect(options()).toHaveLength(0);
    });

    it("leaves the box typeable, with numbers beyond the list", () => {
        input.value = 250;

        expect(input.disabled).toBe(false);
        expect(input.value).toBe("250");

        open();

        expect(document.querySelector(".number-list .selected")).toBeNull();
    });

    it("closes when pressing outside, on Escape, and on its button", () => {
        open();
        document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(options()).toHaveLength(0);

        open();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(options()).toHaveLength(0);

        open();
        open();
        expect(options()).toHaveLength(0);
    });

    it("stays open while scrolling the list itself, but not what's behind it", () => {
        open();

        document.querySelector(".number-list").dispatchEvent(new Event("scroll"));
        expect(options()).toHaveLength(10);

        document.getElementById("box").dispatchEvent(new Event("scroll"));
        expect(options()).toHaveLength(0);
    });

    it("stays open when something unrelated scrolls", () => {
        const other = document.createElement("div");

        document.body.append(other);

        open();
        other.dispatchEvent(new Event("scroll"));

        expect(options()).toHaveLength(10);
    });

    it("stays open when only the height changes, as a phone's address bar does", () => {
        const width = window.innerWidth;

        open();
        window.dispatchEvent(new Event("resize"));
        expect(options()).toHaveLength(10);

        window.innerWidth = width + 100;
        window.dispatchEvent(new Event("resize"));
        expect(options()).toHaveLength(0);

        window.innerWidth = width;
    });
});
