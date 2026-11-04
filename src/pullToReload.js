import { element, hide, show } from "./dom.js";

/*
 * Swiping down on a top bar reloads the page. The browser's own swipe to reload
 * can't be limited to part of the page, and it needs the page to be able to
 * slide, which the tile view doesn't allow. So the top bars do it themselves,
 * and tell the browser to leave swipes on them alone (see style.css).
 */

// How far a finger goes before it counts as a pull, rather than a tap that slipped
const SLIP = 12;

export const PULL_DISTANCE = 90;

let indicator = null;

function showIndicator(distance) {
    if (!indicator?.isConnected) {
        indicator = element("div", "pull-indicator hidden");
        indicator.setAttribute("role", "status");

        document.body.append(indicator);
    }

    indicator.textContent = distance >= PULL_DISTANCE ? "Let go to reload" : "Pull down to reload";
    indicator.classList.toggle("ready", distance >= PULL_DISTANCE);
    indicator.style.setProperty("--pull", `${Math.min(distance, PULL_DISTANCE)}px`);

    show(indicator);
}

function hideIndicator() {
    if (indicator) {
        hide(indicator);
    }
}

export function addPullToReload(area, reload = () => window.location.reload()) {
    let start = null;
    let distance = 0;
    let pulling = false;

    // A pull that ended on a button isn't a press of that button
    let ignoreClick = false;

    const finish = () => {
        start = null;
        pulling = false;
    };

    area.addEventListener("pointerdown", event => {
        ignoreClick = false;
        pulling = false;
        start = event.pointerType === "touch" && !event.target.closest("input, select, textarea")
            ? { id: event.pointerId, x: event.clientX, y: event.clientY }
            : null;
    });

    area.addEventListener("pointermove", event => {
        if (!start || event.pointerId !== start.id) {
            return;
        }

        const across = Math.abs(event.clientX - start.x);

        distance = event.clientY - start.y;

        if (!pulling) {
            if (distance > SLIP && distance > across) {
                pulling = true;
            } else if (across > SLIP || distance < -SLIP) {
                // Going somewhere else, which isn't a pull even if it turns downwards later
                finish();

                return;
            } else {
                return;
            }
        }

        showIndicator(distance);
    });

    area.addEventListener("pointerup", event => {
        if (!start || event.pointerId !== start.id) {
            return;
        }

        if (pulling) {
            ignoreClick = true;

            if (distance >= PULL_DISTANCE) {
                reload();
            } else {
                hideIndicator();
            }
        }

        finish();
    });

    area.addEventListener("pointercancel", () => {
        hideIndicator();
        finish();
    });

    area.addEventListener("click", event => {
        if (ignoreClick) {
            event.preventDefault();
            event.stopPropagation();

            ignoreClick = false;
        }
    }, true);
}
