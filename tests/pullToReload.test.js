import { beforeEach, describe, expect, it, vi } from "vitest";
import { PULL_DISTANCE, addPullToReload } from "../src/pullToReload.js";

function pointer(target, type, { x = 0, y = 0, pointerType = "touch", pointerId = 1 } = {}) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });

    Object.assign(event, { pointerType, pointerId });
    target.dispatchEvent(event);
}

describe("swiping down to reload", () => {
    let area;
    let button;
    let reload;
    let pressed;

    const swipe = (toY, toX = 0, options = {}) => {
        pointer(button, "pointerdown", options);
        pointer(button, "pointermove", { y: toY / 2, x: toX / 2, ...options });
        pointer(button, "pointermove", { y: toY, x: toX, ...options });
        pointer(button, "pointerup", { y: toY, x: toX, ...options });
    };

    const indicatorShown = () => {
        const indicator = document.querySelector(".pull-indicator");

        return Boolean(indicator) && !indicator.classList.contains("hidden");
    };

    beforeEach(() => {
        document.body.innerHTML = `<div id="area"><button id="button">HP</button></div>`;

        area = document.getElementById("area");
        button = document.getElementById("button");
        reload = vi.fn();
        pressed = vi.fn();

        button.addEventListener("click", pressed);
        addPullToReload(area, reload);
    });

    it("reloads after a long enough pull", () => {
        swipe(PULL_DISTANCE + 10);

        expect(reload).toHaveBeenCalledOnce();
    });

    it("doesn't reload after a short pull, and takes its message away again", () => {
        pointer(button, "pointerdown");
        pointer(button, "pointermove", { y: 40 });
        expect(indicatorShown()).toBe(true);

        pointer(button, "pointerup", { y: 40 });

        expect(reload).not.toHaveBeenCalled();
        expect(indicatorShown()).toBe(false);
    });

    it("says when letting go will reload", () => {
        pointer(button, "pointerdown");
        pointer(button, "pointermove", { y: 40 });
        expect(document.querySelector(".pull-indicator").textContent).toBe("Pull down to reload");

        pointer(button, "pointermove", { y: PULL_DISTANCE });
        expect(document.querySelector(".pull-indicator").textContent).toBe("Let go to reload");

        pointer(button, "pointercancel");
        expect(reload).not.toHaveBeenCalled();
    });

    it("ignores sideways and upward swipes, even if they turn downwards later", () => {
        swipe(PULL_DISTANCE + 10, 300);
        expect(reload).not.toHaveBeenCalled();

        pointer(button, "pointerdown");
        pointer(button, "pointermove", { y: -40 });
        pointer(button, "pointermove", { y: PULL_DISTANCE + 10 });
        pointer(button, "pointerup", { y: PULL_DISTANCE + 10 });
        expect(reload).not.toHaveBeenCalled();
    });

    it("ignores a mouse", () => {
        swipe(PULL_DISTANCE + 10, 0, { pointerType: "mouse" });

        expect(reload).not.toHaveBeenCalled();
    });

    it("leaves text boxes alone", () => {
        area.innerHTML = `<input id="box">`;

        const box = document.getElementById("box");

        pointer(box, "pointerdown");
        pointer(box, "pointermove", { y: PULL_DISTANCE + 10 });
        pointer(box, "pointerup", { y: PULL_DISTANCE + 10 });

        expect(reload).not.toHaveBeenCalled();
    });

    it("a pull that ends on a button doesn't press it, but a tap still does", () => {
        swipe(40);
        button.click();
        expect(pressed).not.toHaveBeenCalled();

        pointer(button, "pointerdown");
        pointer(button, "pointerup");
        button.click();
        expect(pressed).toHaveBeenCalledOnce();
    });
});
