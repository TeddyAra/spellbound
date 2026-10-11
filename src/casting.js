import { $, show, hide, element, sum } from "./dom.js";
import {
    state,
    commit,
    rank,
    schoolName,
    mortalLimit,
    weaponMortalLimit,
    surgeThreshold,
    subclassIs,
    hasFeat,
    weaponDie,
    weaponExtraDice
} from "./state.js";
import {
    castingPool,
    SAVING_THROWS,
    SPELL_LEVEL_SCALE,
    CREATION_QUALITY,
    biggerDie,
    splitDice
} from "./rules.js";
import { rollDice } from "./dice.js";
import { preference, setPreference } from "./preferences.js";
import { spawnScrabbleLetters } from "./tiles.js";
import { showInfoResult } from "./results.js";
import { updateCurrentHealth } from "./character.js";
import { openSaveSpell, hasEmptySlot } from "./spellSlots.js";

/*
 * Every pre-turn starts here: pick what you're rolling for, roll the casting
 * pool of a school, and read it three ways (success, level, tiles).
 *
 * Modes:
 *   spell     a new spell: draws tiles equal to the total
 *   saved     a saved spell: casts at its saved level, then may grow
 *   mundane   no tiles, level capped by the mortal limit
 *   weapon    a mundane Harm action that rolls the weapon die per level
 *   save      a saving throw: only success matters
 *   counter   Prepare: each surge lowers an enemy spell's level
 */

const MODES = {
    spell: { label: "New spell" },
    mundane: { label: "Mundane action" },
    weapon: { label: "Weapon attack" },
    save: { label: "Saving throw" },
    counter: { label: "Counter" }
};

const rollSetupOverlay = $("rollSetupOverlay");
const rollResultOverlay = $("rollResultOverlay");
const actionPanel = $("actionPanel");
const dcInput = $("dcInput");

// What's being set up in the roll window
let setup = { school: "harm", mode: "spell", slotIndex: null, extraDice: 0 };

// The last roll: { school, mode, slotIndex, sides, rolls, rerolled: Set, dc, overchannel }
let roll = null;

/* The modes a school can be rolled for. */
function modesFor(school) {
    const modes = ["spell", "mundane"];

    if (school === "harm") {
        modes.push("weapon");
    }

    if (SAVING_THROWS[school]) {
        modes.push("save");
    }

    modes.push("counter");

    return modes;
}

/* The school a roll uses: weapon attacks always roll Harm. */
const rollSchool = ({ school, mode }) => mode === "weapon" ? "harm" : school;

/* Dice added by feats: [label, count]. */
function automaticDice({ school, mode }) {
    const dice = [];

    if (mode === "mundane" && school === "control" && hasFeat("persuasive")) {
        dice.push(["Persuasive", 1]);
    }

    if (mode === "mundane" && school === "reveal" && hasFeat("keenSenses")) {
        dice.push(["Keen Senses", 1]);
    }

    if (mode === "save" && hasFeat("steadyMind")) {
        dice.push(["Steady Mind", 1]);
    }

    return dice;
}

function diceCount(options) {
    const pool = castingPool(rank(rollSchool(options)));
    const extra = sum(automaticDice(options).map(([, count]) => count)) + options.extraDice;

    // A pool never drops below one die
    return Math.max(1, pool.count + extra);
}

/* The highest level this roll can reach. */
function levelCap({ school, mode }) {
    if (mode === "mundane") {
        return Math.min(rank(school), mortalLimit(school));
    }

    if (mode === "weapon") {
        return Math.min(rank("harm"), weaponMortalLimit());
    }

    return rank(school);
}

/*
 * =========================================================
 * ROLL SETUP
 * =========================================================
 */

function modeHint() {
    const { school, mode } = setup;

    switch (mode) {
        case "spell":
            return "Draw tiles equal to your total, and spell your spell on your casting turn.";
        case "saved": {
            const slot = state.spellSlots[setup.slotIndex];

            return `Casts ${slot.name.toUpperCase()} at level ${slot.level}. No tiles. A successful cast may grow it.`;
        }
        case "mundane":
            return `No tiles, no backfire. Level capped at your mortal limit of ${mortalLimit(school)}.`;
        case "weapon":
            return `Damage: d${weaponDie()} per level. Mortal limit ${weaponMortalLimit()}.`;
        case "save":
            return `Resists: ${SAVING_THROWS[school]}. Against a spell, the DC is its level + 3.`;
        case "counter":
            return "Each surge lowers the spell's level by 1. Below level 1, it fizzles.";
    }
}

function renderSetup() {
    const school = rollSchool(setup);
    const { sides } = castingPool(rank(school));

    $("rollSetupTitle").textContent = setup.mode === "saved"
        ? state.spellSlots[setup.slotIndex].name.toUpperCase()
        : setup.mode === "weapon"
            ? state.weapon.name.trim() || "Weapon attack"
            : schoolName(setup.school);

    $("rollSetupPool").textContent = `${schoolName(school)} rank ${rank(school)}`;

    const modes = $("rollModes");

    if (setup.mode === "saved") {
        modes.replaceChildren();
    } else {
        modes.replaceChildren(...modesFor(setup.school).map(mode => {
            const button = element("button", mode === setup.mode ? "selected" : null, MODES[mode].label);

            button.type = "button";
            button.addEventListener("click", () => {
                setup.mode = mode;
                renderSetup();
            });

            return button;
        }));
    }

    $("rollModeHint").textContent = modeHint();
    $("extraDiceDisplay").textContent = setup.extraDice > 0 ? `+${setup.extraDice}` : setup.extraDice;

    const bonuses = automaticDice(setup).map(([label, count]) => `${label} +${count}`);

    $("rollSetupDice").textContent = `Rolling ${diceCount(setup)}d${sides}` +
        (bonuses.length ? ` (${bonuses.join(", ")})` : "");
}

/* Opens the roll window for a school, a weapon attack, or a saved spell (slotIndex). */
export function openRollSetup(school, mode = "spell", slotIndex = null) {
    setup = { school, mode, slotIndex, extraDice: 0 };
    dcInput.value = preference("rememberDC") ? preference("lastDC") : "";

    renderSetup();
    show(rollSetupOverlay);

    // Selected, so typing a new DC replaces a remembered one
    dcInput.focus();
    dcInput.select();
}

$("extraDiceMinus").addEventListener("click", () => {
    setup.extraDice = Math.max(-10, setup.extraDice - 1);
    renderSetup();
});

$("extraDicePlus").addEventListener("click", () => {
    setup.extraDice = Math.min(10, setup.extraDice + 1);
    renderSetup();
});

$("cancelRoll").addEventListener("click", () => hide(rollSetupOverlay));

async function confirmRoll() {
    hide(rollSetupOverlay);

    // For "Remember the DC" in Settings
    setPreference("lastDC", dcInput.value);

    const school = rollSchool(setup);
    const { sides } = castingPool(rank(school));
    const rolls = await rollDice(`${diceCount(setup)}d${sides}`);

    if (!rolls) {
        return;
    }

    const dc = parseInt(dcInput.value, 10);

    roll = {
        ...setup,
        school,
        sides,
        rolls,
        rerolled: new Set(),
        dc: Number.isNaN(dc) ? null : dc,
        overchannel: 0
    };

    renderResult();
    show(rollResultOverlay);
}

$("confirmRoll").addEventListener("click", confirmRoll);

dcInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        confirmRoll();
    }
});

for (const button of document.querySelectorAll(".school-button")) {
    button.addEventListener("click", () => openRollSetup(button.dataset.school));
}

$("weaponButton").addEventListener("click", () => openRollSetup("harm", "weapon"));

/*
 * =========================================================
 * READING THE ROLL
 * =========================================================
 */

function readRoll() {
    const threshold = surgeThreshold();
    const surges = roll.rolls.filter(value => value >= threshold).length;
    const cap = levelCap(roll);

    const level = roll.mode === "saved"
        ? state.spellSlots[roll.slotIndex].level
        : Math.min(Math.max(1, surges), cap) + roll.overchannel;

    // Lexicographer: Well-Read draws 2 extra tiles
    const extraTiles = subclassIs("lexicographer") ? 2 : 0;

    return {
        threshold,
        surges,
        cap,
        level,
        total: sum(roll.rolls),
        tiles: sum(roll.rolls) + extraTiles,
        extraTiles,
        highest: Math.max(...roll.rolls),
        success: roll.dc === null ? null : roll.rolls.some(value => value >= roll.dc)
    };
}

function resultRow(label, value, note) {
    const row = element("div", "result-row");
    const valueElement = element("strong", null, value);

    if (note) {
        valueElement.append(element("small", "result-note", ` ${note}`));
    }

    row.append(element("span", "result-label", label), valueElement);

    return row;
}

function renderOutcome(reading) {
    const outcome = $("rollOutcome");

    if (reading.success === null) {
        outcome.className = "outcome unknown";
        outcome.textContent = `Highest roll ${reading.highest}: succeeds against a DC up to ${reading.highest}`;
    } else if (reading.success) {
        outcome.className = "outcome success";
        outcome.textContent = roll.mode === "save" ? `Resisted (DC ${roll.dc})` : `Success (DC ${roll.dc})`;
    } else {
        outcome.className = "outcome failure";
        outcome.textContent = roll.mode === "save"
            ? `Failed to resist (DC ${roll.dc})`
            : `Failure (DC ${roll.dc}): no tiles, no action this round`;
    }
}

function renderResultDice(reading) {
    const container = $("rollResultDice");

    container.replaceChildren(...roll.rolls.map((value, index) => {
        const rerolled = roll.rerolled.has(index);
        const die = element("button", "die", value);

        die.type = "button";
        die.classList.toggle("high", value >= reading.threshold);
        die.classList.toggle("meets-dc", roll.dc !== null && value >= roll.dc);
        die.classList.toggle("rerolled", rerolled);
        die.disabled = rerolled;
        die.title = rerolled ? "Already rerolled" : "Reroll this die (you must keep the new result)";

        die.addEventListener("click", () => rerollDie(index));

        return die;
    }));

    $("rerollHint").textContent = roll.rerolled.size < roll.rolls.length ? "· click a die to reroll it" : "";
}

async function rerollDie(index) {
    hide(rollResultOverlay);

    const rolls = await rollDice(`1d${roll.sides}`);

    if (rolls) {
        roll.rolls[index] = rolls[0];
        roll.rerolled.add(index);
    }

    renderResult();
    show(rollResultOverlay);
}

function actionButton(label, className, onClick) {
    const button = element("button", className, label);

    button.type = "button";
    button.addEventListener("click", onClick);

    return button;
}

function renderResult() {
    const reading = readRoll();
    const rows = [];
    const actions = [];
    const failed = reading.success === false;

    $("rollResultTitle").textContent = $("rollSetupTitle").textContent;

    renderOutcome(reading);

    const surgeLabel = reading.threshold === 4 ? "Surges (4+, Torrent of Words)" : "Surges (5+)";

    switch (roll.mode) {
        case "spell":
        case "mundane":
        case "weapon": {
            const capNote = reading.surges > reading.cap
                ? roll.mode === "spell" ? `(capped at rank ${reading.cap})` : `(capped at ${reading.cap})`
                : roll.overchannel ? "(Overchannel +1)" : null;

            rows.push(resultRow(surgeLabel, reading.surges));
            rows.push(resultRow("Level", reading.level, capNote));

            if (roll.mode === "spell") {
                rows.push(resultRow("Tiles", reading.tiles, reading.extraTiles ? `(Well-Read +${reading.extraTiles}, return 2)` : null));
            }

            break;
        }

        case "saved":
            rows.push(resultRow("Saved level", reading.level));
            break;

        case "save":
            rows.push(resultRow("Highest roll", reading.highest));
            break;

        case "counter":
            rows.push(resultRow(surgeLabel, reading.surges));
            rows.push(resultRow("Lowers the spell's level by", reading.surges));
            break;
    }

    $("rollResultRows").replaceChildren(...rows);

    renderResultDice(reading);

    const close = () => hide(rollResultOverlay);

    if (failed || roll.mode === "save" || roll.mode === "counter") {
        actions.push(actionButton("Close", null, close));
    } else {
        if (roll.mode === "spell") {
            actions.push(actionButton(`Draw ${reading.tiles} tiles`, "primary", () => {
                close();
                spawnScrabbleLetters(reading.tiles);
                openActionPanel(reading.level);
            }));

            if (canOverchannel(reading)) {
                actions.push(actionButton("Overchannel", null, overchannel));
            }
        } else if (roll.mode === "saved") {
            actions.push(actionButton("Cast", "primary", () => {
                close();
                castSavedSpell(reading.level);
            }));
        } else if (roll.mode === "weapon") {
            // Damage straight away; the panel stays up for extras like Ambush
            actions.push(actionButton("Roll damage", "primary", () => {
                close();
                openActionPanel(reading.level);
                rollWeaponDamage(reading.level);
            }));
        } else {
            actions.push(actionButton("Act", "primary", () => {
                close();
                openActionPanel(reading.level);
            }));
        }

        actions.push(actionButton("Cancel", "danger", close));
    }

    $("rollResultActions").replaceChildren(...actions);
}

/*
 * =========================================================
 * OVERCHANNEL (Wordweaver, level 3)
 * =========================================================
 */

function canOverchannel(reading) {
    return state.className === "wordweaver"
        && state.level >= 3
        && !roll.overchannel
        && reading.level < reading.cap;
}

async function overchannel() {
    hide(rollResultOverlay);

    const rolls = await rollDice("1d8");

    if (!rolls) {
        show(rollResultOverlay);

        return;
    }

    roll.overchannel = 1;

    updateCurrentHealth(-rolls[0]);

    renderResult();
    show(rollResultOverlay);

    showInfoResult("Overchannel", [["Spell level", `+1`], ["Damage taken (1d8)", rolls[0]]]);
}

/*
 * =========================================================
 * SAVED SPELLS
 * =========================================================
 */

/*
 * After a successful cast, roll one die the size of the school's pool: at
 * least the spell's level raises it by 1, up to the rank. Archivists roll
 * twice and keep the higher.
 */
async function castSavedSpell(level) {
    const slot = state.spellSlots[roll.slotIndex];
    const archivist = subclassIs("archivist");

    openActionPanel(level);

    if (slot.level >= rank(slot.school)) {
        showInfoResult("Spell Growth", [["Level", slot.level], ["", `Already at your ${schoolName(slot.school)} rank`]]);

        return;
    }

    const rolls = await rollDice(`${archivist ? 2 : 1}d${roll.sides}`);

    if (!rolls) {
        return;
    }

    const growth = Math.max(...rolls);
    const oldLevel = slot.level;
    const grows = growth >= oldLevel;

    if (grows) {
        slot.level++;
        commit();
    }

    showInfoResult("Spell Growth", [
        [archivist ? `Growth roll (2d${roll.sides}, Catalogue)` : `Growth roll (d${roll.sides})`, growth],
        [slot.name.toUpperCase(), grows ? `Level ${oldLevel} ➝ ${slot.level}` : `Stays level ${oldLevel}`]
    ]);
}

/*
 * =========================================================
 * CURRENT ACTION: EFFECT DICE
 * =========================================================
 */

// What the action panel shows: { school, mode, level }
let action = null;

/*
 * Rolls `count` dice. With a split (e.g. [2, 1]) they're shared between
 * targets, each with its own total. A bonus (e.g. Healing Hymn) is added to
 * every target's total.
 */
async function rollEffect(title, count, sides, { split = [count], bonus = 0, bonusLabel = null } = {}) {
    const rolls = await rollDice(`${count}d${sides}`);

    if (!rolls) {
        return;
    }

    if (split.length === 1) {
        const rows = [[`${count}d${sides}`, sum(rolls)]];

        if (bonus) {
            rows.push([bonusLabel, `+${bonus}`]);
        }

        rows.push(["Total", sum(rolls) + bonus]);

        showInfoResult(title, rows, { title: "Effect dice", values: rolls });

        return;
    }

    let next = 0;

    const rows = split.map((dice, target) => {
        const own = rolls.slice(next, next += dice);

        return [`Target ${target + 1}: ${dice}d${sides} (${own.join(" + ")}${bonus ? ` + ${bonus}` : ""})`, sum(own) + bonus];
    });

    if (bonus) {
        rows.push([bonusLabel, `+${bonus} each`]);
    }

    showInfoResult(`${title} (${split.length} targets)`, rows, { title: "Effect dice", values: rolls });
}

/* The weapon die once per level, plus Spellfury's extra die. */
function rollWeaponDamage(level) {
    return rollEffect("Weapon Damage", level + weaponExtraDice(), weaponDie());
}

/* Harm, Aid and Passion spells can share their dice between targets (see splitDice in rules.js). */
const hasTargets = ({ school, mode }) => (mode === "spell" || mode === "saved") && ["harm", "aid", "passion"].includes(school);

/* The effect die: the same however the dice are shared. */
function baseEffectDie(school) {
    return effectDie(school, school === "passion" ? 6 : 8);
}

/* A small − value + control. */
function stepper(label, value, { canDown, canUp, down, up, downLabel, upLabel, title = "" }) {
    const counter = element("span", "counter target-counter");
    const minus = element("button", null, "−");
    const plus = element("button", null, "+");

    minus.type = "button";
    plus.type = "button";
    minus.setAttribute("aria-label", downLabel);
    plus.setAttribute("aria-label", upLabel);
    minus.disabled = !canDown;
    plus.disabled = !canUp;
    plus.title = canUp ? "" : title;

    minus.addEventListener("click", down);
    plus.addEventListener("click", up);

    if (label) {
        counter.append(element("span", "result-label", label));
    }

    counter.append(minus, element("strong", null, value), plus);

    return counter;
}

/*
 * Targets − 2 +, and with more than one target, each target's share of the
 * dice. Giving a target another die takes one from the target with the most;
 * taking one away gives it to the target with the fewest.
 */
function targetControls() {
    const { level, split } = action;
    const sides = baseEffectDie(action.school);
    const controls = element("div", "target-controls");

    const setTargets = targets => {
        action.split = splitDice(level, targets);
        renderActionPanel();
    };

    controls.append(stepper("Targets", split.length, {
        canDown: split.length > 1,
        canUp: split.length < level,
        down: () => setTargets(split.length - 1),
        up: () => setTargets(split.length + 1),
        downLabel: "One target fewer",
        upLabel: "One more target",
        title: `At most ${level} targets: one die each`
    }));

    if (split.length === 1) {
        return controls;
    }

    // The other target with the most (or fewest) dice
    const other = (target, pick) => split
        .map((dice, index) => ({ dice, index }))
        .filter(({ index }) => index !== target)
        .reduce((best, entry) => pick(entry.dice, best.dice) ? entry : best);

    split.forEach((dice, target) => {
        const richest = other(target, (a, b) => a > b);

        controls.append(stepper(`Target ${target + 1}`, `${dice}d${sides}`, {
            canDown: dice > 1,
            canUp: richest.dice > 1,
            down: () => {
                action.split[target]--;
                action.split[other(target, (a, b) => a < b).index]++;
                renderActionPanel();
            },
            up: () => {
                action.split[target]++;
                action.split[richest.index]--;
                renderActionPanel();
            },
            downLabel: `One die fewer for target ${target + 1}`,
            upLabel: `One more die for target ${target + 1}`,
            title: "Every other target is down to one die"
        }));
    });

    return controls;
}

/* "3d8" for one target, "2d8 + 1d8" for two */
const splitLabel = (split, sides) => split.map(dice => `${dice}d${sides}`).join(" + ");

function preciseWording() {
    return action.mode !== "mundane" && action.mode !== "weapon"
        && subclassIs("lexicographer") && state.level >= 5
        && action.precise;
}

/* Effect die size for a spell school, after feats and features. */
function effectDie(school, base) {
    let sides = base;

    if (school === "passion" && subclassIs("devotee") && state.level >= 5) {
        sides = 8;
    }

    const focus = { harm: "spellFocusHarm", aid: "spellFocusAid", passion: "spellFocusPassion" }[school];

    if (focus && hasFeat(focus)) {
        sides = biggerDie(sides);
    }

    if (preciseWording()) {
        sides = biggerDie(sides);
    }

    return sides;
}

/* Healing Hymn (Loresinger) and Healing Hands (Lifewarden) add the level to Aid healing. */
function healingBonus(level) {
    if (hasFeat("healingHymn")) {
        return [level, "Healing Hymn"];
    }

    if (subclassIs("lifewarden")) {
        return [level, "Healing Hands"];
    }

    return [0, null];
}

function ambushDice() {
    return state.level >= 9 ? 4 : state.level >= 6 ? 3 : 2;
}

function effectButtons() {
    const { school, mode, level } = action;
    const buttons = [];

    const add = (label, onClick, className = null) => buttons.push(actionButton(label, className, onClick));

    // Weapon damage is rolled straight away (see renderResult)
    if (mode === "weapon") {
        if (state.className === "spellblade") {
            add(`Bladeword: draw ${action.highest} tiles`, () => spawnScrabbleLetters(action.highest));
        }
    } else if (mode === "mundane") {
        if (school === "aid") {
            const sides = hasFeat("fieldMedic") ? 6 : 4;

            add(`First aid ${level}d${sides}`, () => rollEffect("First Aid", level, sides), "primary");
        }
    } else if (hasTargets(action)) {
        const split = [...action.split];
        const sides = baseEffectDie(school);
        const dice = splitLabel(split, sides);

        buttons.push(targetControls());

        if (school === "harm") {
            add(`Damage ${dice}`, () => rollEffect("Harm", level, sides, { split }), "primary");
        } else if (school === "aid") {
            const [bonus, bonusLabel] = healingBonus(level);

            add(`Heal ${dice}`, () => rollEffect("Heal", level, sides, { split, bonus, bonusLabel }), "primary");

            // A ward protects one creature
            add(`Ward ${level}d${sides}`, () => rollEffect("Ward", level, sides));
        } else {
            add(`Effect ${dice}`, () => rollEffect(`${schoolName("passion")} Effect`, level, sides, { split }), "primary");
        }
    }

    if (state.className === "trickster" && (mode === "weapon" || (mode !== "mundane" && school === "harm"))) {
        add(`Ambush +${ambushDice()}d6`, () => rollEffect("Ambush", ambushDice(), 6));
    }

    if (mode === "spell" && hasEmptySlot()) {
        add("Save spell", () => openSaveSpell(school));
    }

    return buttons;
}

function actionHint() {
    const { school, mode, level } = action;

    if (mode === "weapon") {
        const parts = [`Damage: ${level + weaponExtraDice()}d${weaponDie()}${weaponExtraDice() ? " (Spellfury +1 die)" : ""}.`];

        // Bladeword: 4 letters, 5 from Weapon Mastery, one more with Charged Blade, no limit from Spellstorm
        if (state.className === "spellblade") {
            const letters = state.level >= 12 ? null : (state.level >= 6 ? 5 : 4) + (hasFeat("chargedBlade") ? 1 : 0);

            parts.push(letters ? `If it hits, spell a Bladeword of up to ${letters} letters.` : "If it hits, spell a Bladeword of any length.");
        }

        return parts.join(" ");
    }

    if (mode === "mundane") {
        return school === "aid" ? "Describe what you do." : `Describe what you do. ${SPELL_LEVEL_SCALE[level]}.`;
    }

    if (school === "create") {
        return `Creation quality: ${CREATION_QUALITY[level]}.`;
    }

    // Damage and healing scale with the dice, so the level's "several targets" doesn't apply
    if (hasTargets(action)) {
        return level === 1
            ? "One die, so one target."
            : `Share the ${level} dice between up to ${level} targets, at least one die each.`;
    }

    return `${SPELL_LEVEL_SCALE[level]}.`;
}

function renderActionPanel() {
    const { school, mode, level } = action;

    const what = {
        spell: `${schoolName(school)} spell`,
        saved: state.spellSlots[action.slotIndex]?.name.toUpperCase() ?? "Saved spell",
        mundane: `mundane ${schoolName(school)} action`,
        weapon: state.weapon.name.trim() ? `${state.weapon.name.trim()} attack` : "weapon attack"
    }[mode];

    $("actionTitle").textContent = `Level ${level} ${what}`;
    $("actionHint").textContent = actionHint();

    const buttons = effectButtons();

    // Lexicographer: Precise Wording
    if (mode !== "mundane" && mode !== "weapon" && subclassIs("lexicographer") && state.level >= 5
        && ["harm", "aid", "passion"].includes(school)) {
        const toggle = element("label", "check-row");
        const input = element("input");

        input.type = "checkbox";
        input.checked = Boolean(action.precise);
        input.addEventListener("change", () => {
            action.precise = input.checked;
            renderActionPanel();
        });

        toggle.append(input, element("span", null, "7+ letters (Precise Wording)"));
        buttons.push(toggle);
    }

    $("actionButtons").replaceChildren(...buttons);
}

function openActionPanel(level) {
    action = {
        school: roll.school,
        mode: roll.mode,
        slotIndex: roll.slotIndex,
        level,
        highest: Math.max(...roll.rolls),
        precise: false,

        // How the effect dice are shared between targets (see targetControls)
        split: [level]
    };

    renderActionPanel();
    show(actionPanel);
}

$("closeActionPanel").addEventListener("click", () => hide(actionPanel));

/* Redraw when something changes, e.g. saving the spell uses up the last slot. */
document.addEventListener("statechange", () => {
    if (action && !actionPanel.classList.contains("hidden")) {
        renderActionPanel();
    }
});
