import { $, show, hide, element, sum } from "./dom.js";
import {
    state,
    commit,
    saveWithoutUndo,
    addLog,
    rank,
    schoolName,
    mortalLimit,
    weaponMortalLimit,
    surgeThreshold,
    subclassIs,
    hasFeat,
    weaponDie,
    weaponExtraDice,
    equippedWeapons,
    strongestWeapon,
    battleHymnOnSelf,
    enchantedArrows,
    effectiveArmor,
    constructRank,
    constructDie,
    constructParts,
    constructDown,
    partHealth,
    partMaxHealth,
    colossusActive,
    hasFieldRepairs,
    canBeLettered
} from "./state.js";
import {
    castingPool,
    SAVING_THROWS,
    SPELL_LEVEL_SCALE,
    CREATION_QUALITY,
    biggerDie,
    splitDice
} from "./rules.js";
import { rollDice, rollDiceSets } from "./dice.js";
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
 *   weapon    a mundane Harm action that rolls one equipped weapon's die per level
 *   save      a saving throw: only success matters
 *   counter   Prepare: each surge lowers an enemy spell's level
 *
 * A Golemwright's construct rolls its own pool (see construct.js):
 *   constructWeapon   its weapon attack
 *   constructAction   a mundane Change or Create action (Toolkit module)
 */

const MODES = {
    spell: { label: "New spell" },
    mundane: { label: "Mundane action" },
    weapon: { label: "Weapon attack" },
    save: { label: "Saving throw" },
    counter: { label: "Counter" }
};

const isConstruct = ({ mode }) => mode === "constructWeapon" || mode === "constructAction";

/* Rolls that deal weapon damage, the character's or the construct's. */
const isWeaponMode = mode => mode === "weapon" || mode === "constructWeapon";

const rollSetupOverlay = $("rollSetupOverlay");
const rollResultOverlay = $("rollResultOverlay");
const actionPanel = $("actionPanel");
const dcInput = $("dcInput");

// What's being set up in the roll window
let setup = { school: "harm", mode: "spell", slotIndex: null, weaponId: null, extraDice: 0 };

// The last roll: { school, mode, slotIndex, weaponId, sides, rolls, rerolled: Set, dc, overchannel }
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

/* The weapon a roll or action is for. If it has been thrown away since: the best one left. */
const attackWeapon = ({ weaponId }) => state.weapons.find(weapon => weapon.id === weaponId) ?? strongestWeapon();

/* The school a roll uses: weapon attacks always roll Harm. */
const rollSchool = ({ school, mode }) => isWeaponMode(mode) ? "harm" : school;

/* The rank whose pool is rolled: the school's, or the construct's own (its Toolkit uses its attack rank). */
function poolRank(options) {
    return isConstruct(options) ? constructRank() : rank(rollSchool(options));
}

/* Runesmith (Lettered): ticked for Reveal actions on writing, symbols and traps. */
const lettered = ({ school, mode, lettered }) => mode === "mundane" && Boolean(lettered) && canBeLettered(school);

/* Dice added by feats: [label, count]. */
function automaticDice({ school, mode }) {
    const dice = [];

    if (isConstruct({ mode })) {
        return dice;
    }

    if (battleHymnOnSelf()) {
        dice.push(["Battle Hymn", 1]);
    }

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
    const pool = castingPool(poolRank(options));
    const extra = sum(automaticDice(options).map(([, count]) => count)) + options.extraDice;

    // A pool never drops below one die
    return Math.max(1, pool.count + extra);
}

/* The highest level this roll can reach. A construct's actions are mundane, so they stop at 3. */
function levelCap(options) {
    const { school, mode } = options;

    if (isConstruct({ mode })) {
        return Math.min(poolRank({ mode }), 3);
    }

    if (mode === "mundane") {
        return Math.min(rank(school), mortalLimit(school, lettered(options)));
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
            return `No tiles, no backfire. Level capped at your mortal limit of ${mortalLimit(school, lettered(setup))}.`;
        case "weapon":
            return `Damage: d${weaponDie(attackWeapon(setup))} per level. Mortal limit ${weaponMortalLimit()}.` +
                (attackWeapon(setup)?.description ? ` ${attackWeapon(setup).description}` : "");
        case "save":
            return `Resists: ${SAVING_THROWS[school]}. Against a spell, the DC is its level + 3.`;
        case "counter":
            return "Each surge lowers the spell's level by 1. Below level 1, it fizzles.";
        case "constructWeapon":
            return `Damage: d${constructDie()} per level. Mortal limit 3. Rolled during your pre-turn, right after your own roll.` +
                (colossusActive() ? " Colossus: twice the dice on one target, or stomp every enemy within 10 feet." : "");
        case "constructAction":
            return "Toolkit: instead of attacking, a mundane Change or Create action with its attack rank. No tiles, mortal limit 3.";
    }
}

/* The construct's Toolkit picks Change or Create; every other roll picks one of the school's modes. */
function modeButtons() {
    if (setup.mode === "constructAction") {
        return ["change", "create"].map(school => {
            const button = element("button", school === setup.school ? "selected" : null, schoolName(school));

            button.type = "button";
            button.addEventListener("click", () => {
                setup.school = school;
                renderSetup();
            });

            return button;
        });
    }

    if (setup.mode === "saved" || isConstruct(setup)) {
        return [];
    }

    const modeButton = (label, selected, change) => {
        const button = element("button", selected ? "selected" : null, label);

        button.type = "button";
        button.addEventListener("click", () => {
            Object.assign(setup, change);
            renderSetup();
        });

        return button;
    };

    // Each equipped weapon is a mode of its own
    return modesFor(setup.school).flatMap(mode => mode === "weapon"
        ? equippedWeapons().map(weapon => modeButton(weapon.name, setup.mode === "weapon" && setup.weaponId === weapon.id, { mode, weaponId: weapon.id }))
        : [modeButton(MODES[mode].label, mode === setup.mode, { mode })]);
}

function renderSetup() {
    const school = rollSchool(setup);
    const { sides } = castingPool(poolRank(setup));

    $("rollSetupTitle").textContent = setup.mode === "saved"
        ? state.spellSlots[setup.slotIndex].name.toUpperCase()
        : setup.mode === "weapon"
            ? attackWeapon(setup)?.name ?? "Weapon attack"
            : isConstruct(setup)
                ? `${constructName()} ${setup.mode === "constructWeapon" ? "attack" : "action"}`
                : schoolName(setup.school);

    $("rollSetupPool").textContent = isConstruct(setup)
        ? `Construct rank ${poolRank(setup)}`
        : `${schoolName(school)} rank ${rank(school)}`;

    $("rollModes").replaceChildren(...modeButtons());

    $("rollModeHint").textContent = modeHint();

    $("letteredRow").classList.toggle("hidden", !(setup.mode === "mundane" && canBeLettered(setup.school)));
    $("letteredInput").checked = Boolean(setup.lettered);
    $("extraDiceDisplay").textContent = setup.extraDice > 0 ? `+${setup.extraDice}` : setup.extraDice;

    const bonuses = automaticDice(setup).map(([label, count]) => `${label} +${count}`);

    $("rollSetupDice").textContent = `Rolling ${diceCount(setup)}d${sides}` +
        (bonuses.length ? ` (${bonuses.join(", ")})` : "");
}

/* Opens the roll window for a school, a weapon attack (weaponId), or a saved spell (slotIndex). */
export function openRollSetup(school, mode = "spell", slotIndex = null, weaponId = null) {
    setup = { school, mode, slotIndex, weaponId, extraDice: 0, lettered: false };
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

$("letteredInput").addEventListener("change", event => {
    setup.lettered = event.target.checked;
    renderSetup();
});

$("cancelRoll").addEventListener("click", () => hide(rollSetupOverlay));

async function confirmRoll() {
    hide(rollSetupOverlay);

    // For "Remember the DC" in Settings
    setPreference("lastDC", dcInput.value);

    const school = rollSchool(setup);
    const { sides } = castingPool(poolRank(setup));
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

    logRoll();
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

/* One button per equipped weapon, above the schools. */
function weaponButton(weapon) {
    const button = element("button", "roll-button");

    button.title = `${weapon.name}: a mundane Harm action` + (weapon.description ? `\n\n${weapon.description}` : "");
    button.append(element("span", null, weapon.name), element("span", "weapon-die", `d${weaponDie(weapon)}`));
    button.addEventListener("click", () => openRollSetup("harm", "weapon", null, weapon.id));

    return button;
}

document.addEventListener("statechange", () => {
    $("weaponButtons").replaceChildren(...equippedWeapons().map(weaponButton));
});

/*
 * =========================================================
 * READING THE ROLL
 * =========================================================
 */

function readRoll() {
    // Torrent of Words is the Wordweaver's, not their construct's
    const threshold = isConstruct(roll) ? 5 : surgeThreshold();
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

/* The pre-turn in the log: "New spell · DC 3: success · Level 2 · 9 tiles" */
function logRoll() {
    const reading = readRoll();
    const parts = [{
        ...Object.fromEntries(Object.entries(MODES).map(([key, { label }]) => [key, label])),
        saved: "Saved spell",
        constructWeapon: "Construct attack",
        constructAction: "Construct action"
    }[roll.mode]];

    if (roll.dc !== null) {
        parts.push(`DC ${roll.dc}: ${reading.success ? "success" : "failure"}`);
    }

    if (reading.success !== false) {
        if (roll.mode === "save") {
            parts.push(`Highest ${reading.highest}`);
        } else if (roll.mode === "counter") {
            parts.push(`Lowers the level by ${reading.surges}`);
        } else {
            parts.push(`Level ${reading.level}`);
        }

        if (roll.mode === "spell") {
            parts.push(`${reading.tiles} tiles`);
        }
    }

    addLog($("rollResultTitle").textContent, parts.join(" · "), [...roll.rolls]);
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

    $("rerollHint").textContent = roll.rerolled.size < roll.rolls.length ? "· choose a die to reroll it" : "";
}

async function rerollDie(index) {
    hide(rollResultOverlay);

    const rolls = await rollDice(`1d${roll.sides}`);

    if (rolls) {
        addLog($("rollResultTitle").textContent, `Rerolled a die: ${roll.rolls[index]} ➝ ${rolls[0]}`);

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
        case "weapon":
        case "constructWeapon":
        case "constructAction": {
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
            actions.push(actionButton(`Draw ${reading.tiles} ${reading.tiles === 1 ? "tile" : "tiles"}`, "primary", () => {
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
                addLog("Cast a saved spell", `${state.spellSlots[roll.slotIndex].name.toUpperCase()} at level ${reading.level}`);
                castSavedSpell(reading.level);
            }));
        } else if (isWeaponMode(roll.mode)) {
            // Damage straight away; the panel stays up for extras like Ambush
            actions.push(actionButton("Roll damage", "primary", () => {
                close();
                openActionPanel(reading.level);
                rollWeaponDamage(reading.level, roll.mode);
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

    updateCurrentHealth(-rolls[0], { label: "Overchannel", toast: false });

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
        commit(`${slot.name.toUpperCase()} grew`);
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
 * targets, each with its own total. A bonus per die (e.g. Healing Hymn's +1)
 * follows the dice: 2d8 + 2 and 1d8 + 1.
 */
async function rollEffect(title, count, sides, { split = [count], bonusPerDie = 0, bonusLabel = null, extra = null } = {}) {
    // An extra die of another size, e.g. War Chant's 1d4: { sides, label }
    const sets = await rollDiceSets(`${count}d${sides}` + (extra ? `+1d${extra.sides}` : ""));

    if (!sets) {
        return;
    }

    const rolls = sets[0];

    if (split.length === 1) {
        const bonus = bonusPerDie * count;
        const extraRoll = extra ? sum(sets[1]) : 0;
        const rows = [[`${count}d${sides}`, sum(rolls)]];

        if (bonus) {
            rows.push([bonusLabel, `+${bonus}`]);
        }

        if (extra) {
            rows.push([`${extra.label} (1d${extra.sides})`, `+${extraRoll}`]);
        }

        rows.push(["Total", sum(rolls) + bonus + extraRoll]);

        showInfoResult(title, rows, { title: "Effect dice", values: sets.flat() });

        return;
    }

    let next = 0;

    const rows = split.map((dice, target) => {
        const own = rolls.slice(next, next += dice);
        const bonus = bonusPerDie * dice;

        return [`Target ${target + 1}: ${dice}d${sides} (${own.join(" + ")}${bonus ? ` + ${bonus}` : ""})`, sum(own) + bonus];
    });

    if (bonusPerDie) {
        rows.push([bonusLabel, `+${bonusPerDie} per die`]);
    }

    showInfoResult(`${title} (${split.length} targets)`, rows, { title: "Effect dice", values: rolls });
}

/* War Chant (Skald): while Battle Hymn lasts, weapon attacks deal an extra 1d4. */
const warChant = () => battleHymnOnSelf() ? { sides: 4, label: "War Chant" } : null;

/* The weapon die once per level, plus Spellfury's extra die. A construct rolls its own die. */
function rollWeaponDamage(level, mode = "weapon") {
    if (mode === "constructWeapon") {
        return rollEffect(`${constructName()} Damage`, level, constructDie());
    }

    return rollEffect(`${attackWeapon(action)?.name ?? "Weapon"} Damage`, level + weaponExtraDice(), weaponDie(attackWeapon(action)), { extra: warChant() });
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

const constructName = () => state.construct.name.trim() || "Construct";

function preciseWording() {
    return ["spell", "saved"].includes(action.mode)
        && subclassIs("lexicographer") && state.level >= 5
        && action.precise;
}

/* Effect die size for a spell school, after feats and features. */
function effectDie(school, base) {
    let sides = base;

    // Burning Passion (Devotee): one size bigger, and it adds up with Spell Focus
    if (school === "passion" && subclassIs("devotee") && state.level >= 5) {
        sides = biggerDie(sides);
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

/* Healing Hymn (Loresinger) and Healing Hands (Lifewarden): +1 hit point per effect die. */
function healingBonus() {
    if (hasFeat("healingHymn")) {
        return [1, "Healing Hymn"];
    }

    if (subclassIs("lifewarden")) {
        return [1, "Healing Hands"];
    }

    return [0, null];
}

/*
 * Field Repairs (Golemwright, level 3): heals the construct like first aid,
 * with d8s. First aid has one target, so a Clockmaker repairs the most
 * damaged of their small constructs.
 */
async function repairConstruct(level) {
    const rolls = await rollDice(`${level}d8`);
    const parts = constructParts();
    const part = parts.filter(other => !other.destroyed).sort((a, b) => b.damage - a.damage)[0];

    if (!rolls || !part) {
        return;
    }

    const before = partHealth(part);
    const name = parts.length > 1 ? `${constructName()} ${parts.indexOf(part) + 1}` : constructName();

    part.damage = Math.max(0, part.damage - sum(rolls));
    commit("Field Repairs");

    showInfoResult("Field Repairs", [
        [`${level}d8`, sum(rolls)],
        [`${name} HP`, `${before} ➝ ${partHealth(part)} / ${partMaxHealth()}`]
    ], { title: "Effect dice", values: rolls });
}

function ambushDice() {
    return state.level >= 9 ? 4 : state.level >= 6 ? 3 : 2;
}

function effectButtons() {
    const { school, mode, level } = action;
    const buttons = [];

    const add = (label, onClick, className = null) => buttons.push(actionButton(label, className, onClick));

    // Weapon damage is rolled straight away (see renderResult)
    if (mode === "constructWeapon") {
        if (colossusActive()) {
            // Colossus: one target with twice the dice, or a stomp that hits every enemy within 10 feet
            add(`One target ${level * 2}d${constructDie()}`, () => rollEffect(`${constructName()} Damage`, level * 2, constructDie()), "primary");
            add(`Stomp: ${level}d${constructDie()} each`, () => rollWeaponDamage(level, mode));
        } else {
            add(`Damage again ${level}d${constructDie()}`, () => rollWeaponDamage(level, mode));
        }

        // Sweeping Blows (Warforger): once per round, one more creature next to the target
        if (subclassIs("warforger") && state.level >= 5) {
            add(`Sweeping Blows: second target ${level}d${constructDie()}`, () => rollWeaponDamage(level, mode));
        }
    } else if (mode === "weapon") {
        if (state.className === "spellblade") {
            add(`Bladeword: draw ${action.highest} tiles`, () => spawnScrabbleLetters(action.highest));
        }

        // Volley (Arcane Archer): a second target, its damage rolled separately
        if (enchantedArrows(attackWeapon(action)) && state.level >= 5) {
            add(`Volley: second target ${level + weaponExtraDice()}d${weaponDie(attackWeapon(action))}`, () => rollWeaponDamage(level));
        }
    } else if (mode === "mundane") {
        if (school === "aid") {
            const sides = hasFeat("fieldMedic") ? 6 : 4;

            add(`First aid ${level}d${sides}`, () => rollEffect("First Aid", level, sides), "primary");
        }

        if ((school === "change" || school === "create") && hasFieldRepairs() && !constructDown()) {
            add(`Repair ${constructName()} ${level}d8`, () => repairConstruct(level));
        }
    } else if (hasTargets(action)) {
        const split = [...action.split];
        const sides = baseEffectDie(school);
        const dice = splitLabel(split, sides);

        buttons.push(targetControls());

        if (school === "harm") {
            add(`Damage ${dice}`, () => rollEffect("Harm", level, sides, { split }), "primary");
        } else if (school === "aid") {
            const [bonusPerDie, bonusLabel] = healingBonus();

            add(`Heal ${dice}`, () => rollEffect("Heal", level, sides, { split, bonusPerDie, bonusLabel }), "primary");

            // Wards share their dice the same way: one strong ward, or weaker wards on more creatures
            add(`Ward ${dice}`, () => rollEffect("Ward", level, sides, { split }));
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

/* Aegis (Warden, level 6): anyone you protect with Aid also gains a ward that absorbs damage equal to your armor. */
function aegisHint() {
    return state.className === "warden" && state.level >= 6
        ? ` Aegis: everyone you protect also gains a ward absorbing ${effectiveArmor()} damage until your next turn.`
        : "";
}

function actionHint() {
    const { school, mode, level } = action;

    if (mode === "constructWeapon") {
        return colossusActive()
            ? `Colossus: ${level * 2}d${constructDie()} on one target, or stomp for ${level}d${constructDie()} on every enemy within 10 feet, rolled separately.`
            : `Damage: ${level}d${constructDie()}.`;
    }

    if (mode === "constructAction") {
        return `Describe what ${constructName()} does. ${SPELL_LEVEL_SCALE[level]}.`;
    }

    if (mode === "weapon") {
        const extras = [
            weaponExtraDice() ? "Spellfury +1 die" : null,
            warChant() ? "War Chant +1d4" : null
        ].filter(Boolean);

        const parts = [`Damage: ${level + weaponExtraDice()}d${weaponDie(attackWeapon(action))}${warChant() ? " + 1d4" : ""}${extras.length ? ` (${extras.join(", ")})` : ""}.`];

        // Bladeword: 4 letters, 5 from Weapon Mastery, one more with Charged Blade, no limit from Spellstorm
        if (state.className === "spellblade") {
            const letters = state.level >= 12 ? null : (state.level >= 6 ? 5 : 4) + (hasFeat("chargedBlade") ? 1 : 0);

            parts.push(letters ? `If it hits, spell a Bladeword of up to ${letters} letters.` : "If it hits, spell a Bladeword of any length.");
        }

        return parts.join(" ");
    }

    if (mode === "mundane") {
        return school === "aid" ? `Describe what you do.${aegisHint()}` : `Describe what you do. ${SPELL_LEVEL_SCALE[level]}.`;
    }

    if (school === "create") {
        const quality = `Creation quality: ${CREATION_QUALITY[level]}.`;

        // Tinker's Eye (Golemwright): one quality step better, though not bigger
        return state.className === "golemwright" && level < 8
            ? `${quality} Tinker's Eye: made as well as ${CREATION_QUALITY[level + 1].split(",")[0].toLowerCase()}, at the same size.`
            : quality;
    }

    // Damage and healing scale with the dice, so the level's "several targets" doesn't apply
    if (hasTargets(action)) {
        const sharing = level === 1
            ? "One die, so one target."
            : `Share the ${level} dice between up to ${level} targets, at least one die each.`;

        return school === "aid" ? sharing + aegisHint() : sharing;
    }

    return `${SPELL_LEVEL_SCALE[level]}.`;
}

function renderActionPanel() {
    const { school, mode, level } = action;

    const what = {
        spell: `${schoolName(school)} spell`,
        saved: state.spellSlots[action.slotIndex]?.name.toUpperCase() ?? "Saved spell",
        mundane: `mundane ${schoolName(school)} action`,
        weapon: attackWeapon(action) ? `${attackWeapon(action).name} attack` : "weapon attack",
        constructWeapon: `${constructName()} attack`,
        constructAction: `${constructName()} action`
    }[mode];

    $("actionTitle").textContent = `Level ${level} ${what}`;
    $("actionHint").textContent = actionHint();

    const buttons = effectButtons();

    // Lexicographer: Precise Wording
    if (["spell", "saved"].includes(mode) && subclassIs("lexicographer") && state.level >= 5
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

    // Kept with the character, so a reload doesn't lose the spell being cast
    saveWithoutUndo();
}

function openActionPanel(level) {
    state.action = {
        school: roll.school,
        mode: roll.mode,
        slotIndex: roll.slotIndex,
        weaponId: roll.weaponId,
        level,
        highest: Math.max(...roll.rolls),
        precise: false,

        // How the effect dice are shared between targets (see targetControls)
        split: [level]
    };

    commit();
}

$("closeActionPanel").addEventListener("click", () => {
    state.action = null;
    commit();
});

/*
 * The panel follows the character: opening and closing it, a reload, undoing
 * Clear Board, another character. It also redraws when something changes, e.g.
 * saving the spell uses up the last slot.
 */
document.addEventListener("statechange", () => {
    action = state.action;

    actionPanel.classList.toggle("hidden", !action);

    if (action) {
        renderActionPanel();
    }
});
