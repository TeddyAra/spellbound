import { describe, expect, it } from "vitest";
import { nearestPage, relocate } from "../src/phoneLayout.js";

describe("which page is showing", () => {
    it("goes by how far the pages have been swiped", () => {
        expect(nearestPage(0, 400, 5)).toBe(0);
        expect(nearestPage(400, 400, 5)).toBe(1);
        expect(nearestPage(790, 400, 5)).toBe(2);
    });

    it("changes page halfway through a swipe", () => {
        expect(nearestPage(199, 400, 5)).toBe(0);
        expect(nearestPage(200, 400, 5)).toBe(1);
    });

    it("stays on an existing page when the browser overshoots", () => {
        expect(nearestPage(-30, 400, 5)).toBe(0);
        expect(nearestPage(5000, 400, 5)).toBe(4);
    });

    it("copes with pages that have no size yet", () => {
        expect(nearestPage(100, 0, 5)).toBe(0);
        expect(nearestPage(100, 400, 0)).toBe(0);
    });
});

describe("moving panels", () => {
    function setup() {
        document.body.innerHTML = `
            <div id="menu"><button id="first"></button><button id="second"></button><button id="third"></button></div>
            <div id="page"></div>
        `;

        return ["menu", "first", "second", "third", "page"].map(id => document.getElementById(id));
    }

    it("moves the same element, so its click handler keeps working", () => {
        const [, , second, , page] = setup();
        let clicks = 0;

        second.addEventListener("click", () => clicks++);

        relocate(second, page);
        page.querySelector("button").click();

        expect(page.firstElementChild).toBe(second);
        expect(clicks).toBe(1);
    });

    it("puts it back in the same place", () => {
        const [menu, , second, , page] = setup();

        const restore = relocate(second, page);

        restore();

        expect([...menu.children].map(child => child.id)).toEqual(["first", "second", "third"]);
        expect(page.children).toHaveLength(0);
    });

    it("puts everything back, undoing moves that went inside each other", () => {
        const [menu, first, second, third, page] = setup();

        const restores = [
            relocate(second, page),
            relocate(first, second),
            relocate(third, page)
        ];

        restores.reverse().forEach(restore => restore());

        expect([...menu.children].map(child => child.id)).toEqual(["first", "second", "third"]);
        expect(second.children).toHaveLength(0);
        expect(page.children).toHaveLength(0);
    });
});
