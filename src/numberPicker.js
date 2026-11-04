import { element } from "./dom.js";

/*
 * A number box with a scrollable dropdown beside it, so a number can be picked
 * without the keyboard. It can still be typed. Picking counts as typing: the
 * input gets the usual "input" event, so whatever reads it needs no changes.
 *
 * It lists up to `max`, or else up to the input's own max when it's opened, or
 * else up to 100. Higher ones can be typed if the input allows them.
 */

const LONGEST_LIST = 100;

const GAP = 4;
const SCREEN_EDGE = 8;

/* Below the box if the list fits there or there's more room than above, otherwise above it. */
export function listPlacement(box, listHeight, screenHeight) {
    const roomBelow = screenHeight - box.bottom - GAP - SCREEN_EDGE;
    const roomAbove = box.top - GAP - SCREEN_EDGE;
    const below = roomBelow >= listHeight || roomBelow >= roomAbove;
    const height = Math.min(listHeight, below ? roomBelow : roomAbove);

    return {
        top: below ? box.bottom + GAP : box.top - GAP - height,
        height
    };
}

let closeOpenList = null;

export function closeNumberList() {
    closeOpenList?.();
}

function openList(input, wrapper, { min, max }) {
    const list = element("div", "number-list");
    const current = parseInt(input.value, 10);

    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", input.getAttribute("aria-label") ?? "Choose a number");

    const last = max ?? (Number(input.max) || LONGEST_LIST);

    for (let number = min; number <= last; number++) {
        const option = element("button", number === current ? "selected" : null, number);

        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(number === current));

        option.addEventListener("click", () => {
            input.value = number;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));

            closeNumberList();
        });

        list.append(option);
    }

    document.body.append(list);

    // Fixed, so the scrolling window it's in doesn't cut it off
    const box = wrapper.getBoundingClientRect();
    const { top, height } = listPlacement(box, list.offsetHeight, window.innerHeight);

    list.style.top = `${top}px`;
    list.style.left = `${box.left}px`;
    list.style.width = `${box.width}px`;
    list.style.height = `${height}px`;

    // Starts at the number that's in the box
    const selected = list.querySelector(".selected");

    if (selected) {
        list.scrollTop = selected.offsetTop - (height - selected.offsetHeight) / 2;
    }

    const onOutside = event => {
        if (!list.contains(event.target) && !wrapper.contains(event.target)) {
            closeNumberList();
        }
    };

    const onKey = event => {
        if (event.key === "Escape") {
            closeNumberList();
        }
    };

    // Scrolling the window it's in would leave it floating in the wrong place
    const onScroll = event => {
        if (event.target === document || event.target.contains?.(wrapper)) {
            closeNumberList();
        }
    };

    // Not for height: phones change that when their address bar slides away
    const openWidth = window.innerWidth;

    const onResize = () => {
        if (window.innerWidth !== openWidth) {
            closeNumberList();
        }
    };

    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    closeOpenList = () => {
        list.remove();

        document.removeEventListener("pointerdown", onOutside);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);

        wrapper.classList.remove("open");
        closeOpenList = null;
    };

    wrapper.classList.add("open");
}

export function addNumberPicker(input, { min = 1, max } = {}) {
    const wrapper = element("span", "number-picker");
    const button = element("button", "number-picker-button");

    button.type = "button";
    button.setAttribute("aria-label", "Choose from a list");
    button.setAttribute("aria-haspopup", "listbox");

    input.replaceWith(wrapper);
    wrapper.append(input, button);

    button.addEventListener("click", () => {
        const wasOpen = wrapper.classList.contains("open");

        closeNumberList();

        if (!wasOpen) {
            openList(input, wrapper, { min, max });
        }
    });

    // Typing replaces the number, rather than adding to it
    input.addEventListener("focus", () => input.select());
    input.addEventListener("pointerdown", closeNumberList);
}
