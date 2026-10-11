import { $, show, hide, element } from "./dom.js";
import { rollDice } from "./dice.js";
import { colorPicker, closeColorPicker } from "./colorPicker.js";
import { RANDOM_COLORS, DICE_FINISHES, loadDiceStyle, saveDiceStyle } from "./diceStyle.js";

/*
 * The dice settings window: the dice colour (or a random one every roll), an
 * optional second colour swirled through it, the numbers' colour and a finish.
 */

const overlay = $("diceSettingsOverlay");

let style = loadDiceStyle();

function update(changes) {
    style = { ...style, ...changes };
    saveDiceStyle(style);
    render();
}

function render() {
    const picker = (label, key, random) => colorPicker({
        label,
        value: style[key],
        random,
        randomColors: RANDOM_COLORS,
        onChange: value => update({ [key]: value })
    });

    $("diceColorPicker").replaceChildren(picker("Dice colour", "color", true));
    $("diceColor2Picker").replaceChildren(picker("Second colour", "color2", true));
    $("diceLabelColorPicker").replaceChildren(picker("Numbers", "labelColor", false));

    $("diceTwoTone").checked = style.twoTone;
    $("diceColor2Row").classList.toggle("hidden", !style.twoTone);

    $("diceFinishes").replaceChildren(...Object.entries(DICE_FINISHES).map(([key, finish]) => {
        const button = element("button", "dice-finish", finish.name);

        button.type = "button";
        button.classList.toggle("selected", style.finish === key);
        button.addEventListener("click", () => update({ finish: key }));

        return button;
    }));
}

$("diceTwoTone").addEventListener("change", event => update({ twoTone: event.target.checked }));

$("diceSettingsButton").addEventListener("click", () => {
    style = loadDiceStyle();
    render();
    show(overlay);
});

function close() {
    closeColorPicker();
    hide(overlay);
}

$("closeDiceSettings").addEventListener("click", close);

// Clicking the backdrop or pressing Escape also closes it (see overlays.js): take the colour grid along
overlay.addEventListener("click", event => {
    if (event.target === overlay) {
        closeColorPicker();
    }
});

// Shows the dice as they are now (the window comes back after the roll)
$("testDiceButton").addEventListener("click", async () => {
    close();
    await rollDice("1d20+1d6");
    show(overlay);
});
