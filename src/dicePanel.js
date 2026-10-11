import { $, show, hide, element, sum } from "./dom.js";
import { rollDice, rollPercentiles } from "./dice.js";
import { showInfoResult } from "./results.js";

const rollDiceOverlay = $("rollDiceOverlay");
const rollDiceInput = $("rollDiceInput");

// The die whose "how many?" dialog is open
let dialogSides = 6;

async function rollGenericDice(sides, count) {
    const rolls = await rollDice(`${count}d${sides}`);

    if (!rolls) {
        return;
    }

    showInfoResult(`${rolls.length}d${sides}`, [
        ["Highest roll", Math.max(...rolls)],
        ["Total sum", sum(rolls)]
    ], { title: "Individual rolls", values: rolls });
}

/* Each die gets a button, plus quick-roll buttons for 1–6 dice that show on hover. */
for (const cell of document.querySelectorAll(".dice-cell[data-sides]")) {
    const sides = Number(cell.dataset.sides);

    const button = element("button", "roll-button dice-button");

    button.append(element("span", null, `D${sides}`));

    button.addEventListener("click", () => {
        dialogSides = sides;

        $("rollDiceTitle").textContent = `Roll d${sides}`;
        rollDiceInput.value = 1;

        show(rollDiceOverlay);
    });

    const quickRoll = element("div", "quick-roll");

    quickRoll.setAttribute("aria-label", "Quick roll");

    for (let count = 1; count <= 6; count++) {
        const quick = element("button", null, count);

        quick.addEventListener("click", () => {
            quick.blur();
            rollGenericDice(sides, count);
        });

        quickRoll.append(quick);
    }

    cell.append(button, quickRoll);
}

$("cancelRollDice").addEventListener("click", () => hide(rollDiceOverlay));

$("confirmRollDice").addEventListener("click", () => {
    hide(rollDiceOverlay);
    rollGenericDice(dialogSides, Math.max(1, parseInt(rollDiceInput.value, 10) || 1));
});

/* The d100 is always a single roll. */
$("rollD100Button").addEventListener("click", async () => {
    const values = await rollPercentiles(1);

    if (values) {
        showInfoResult("d100", [["Result", values[0]]]);
    }
});
