import { $, show, hide, clamp, element, formatModifier, setValue, sum } from "./dom.js";
import { addNumberPicker } from "./numberPicker.js";
import {
    state,
    commit,
    addLog,
    onStateChange,
    characterClass,
    rank,
    rawRank,
    classBonus,
    canRaiseRank,
    levelUp,
    rankPointsLeft,
    tongueAllowedAt,
    knownTongues,
    schoolsOverCap,
    schoolName,
    mortalLimit,
    weaponMortalLimit,
    mortalLimitSources,
    calculatedMaxHealth,
    maxArmor,
    canUseShield,
    equippedWeapons,
    equipShield,
    duelistProblem,
    effectiveArmor,
    initiativeBonus,
    weaponDie,
    hasFeat,
    subclassIs,
    endSignature,
    spellfuryActive,
    hasConstruct,
    hasFieldRepairs,
    hasHelpers,
    constructParts,
    partMaxHealth,
    partHealth,
    restedHelper,
    passiveReveal,
    movementSpeed,
    signatureHasUses,
    runesLast
} from "./state.js";
import {
    CLASSES,
    RANKED_SCHOOLS,
    MAGIC_SCHOOLS,
    MAX_LEVEL,
    SUBCLASS_LEVEL,
    TONGUES,
    ARMOR_TYPES,
    rankCap,
    guardDC,
    poolNotation
} from "./rules.js";
import { rollDice } from "./dice.js";
import { showInfoResult } from "./results.js";
import { renderDeathSaves, deathSaveFailed, resetDeathSaves } from "./deathSaves.js";
import { preference } from "./preferences.js";
import { confirmAction } from "./confirm.js";
import { unspentRanks } from "./reminders.js";

/*
 * =========================================================
 * HIT POINTS
 * =========================================================
 */

const hpManagerOverlay = $("hpManagerOverlay");
const healthAmountInput = $("healthAmountInput");
const wardInput = $("wardInput");

function renderHP() {
    $("hpCurrentDisplay").textContent = state.currentHealth;
    $("hpMaxDisplay").textContent = state.maxHealth;
    $("wardDisplay").textContent = state.ward > 0 ? `🛡 ${state.ward}` : "";

    $("hpModalCurrent").textContent = state.currentHealth;
    $("hpModalMax").textContent = state.maxHealth;
    $("armorHint").textContent = effectiveArmor();

    setValue(wardInput, state.ward);

    renderDeathSaves();
}

/*
 * Damage is reduced in the rulebook's order: halving and Parry first
 * (beforeWard), then the ward absorbs what it can, then armor (afterWard).
 * Damage at 0 HP is a failed death roll; any healing from 0 HP wakes you up
 * and clears them.
 */
export function updateCurrentHealth(amount, { beforeWard = damage => damage, afterWard = damage => damage, label = null, toast = true } = {}) {
    const wasDown = state.currentHealth === 0;
    const result = { reduced: 0, absorbed: 0, taken: 0 };

    if (amount < 0) {
        let damage = beforeWard(-amount);

        result.reduced = damage;

        const wardDamage = Math.min(state.ward, damage);

        state.ward -= wardDamage;

        damage = damage > wardDamage ? afterWard(damage - wardDamage) : 0;

        result.absorbed = wardDamage;
        result.taken = damage;

        state.currentHealth = clamp(state.currentHealth - damage, 0, state.maxHealth);

        if (wasDown && damage > 0) {
            deathSaveFailed();
        }

        // Every signature ability ends early when you're downed
        if (state.currentHealth === 0) {
            endSignature();
        }
    } else {
        state.currentHealth = clamp(state.currentHealth + amount, 0, state.maxHealth);
    }

    if (state.currentHealth > 0) {
        resetDeathSaves();
    }

    commit(label ?? (amount < 0 ? `Took ${result.taken} damage` : `Healed ${amount}`), { toast });

    return result;
}

/* Armor never brings a hit below 1. */
export const armorReduces = armor => damage => damage > 0 ? Math.max(1, damage - armor) : 0;

/* Parry (Spellblade, level 3; Spellguard, level 2): the weapon die, rolled twice with a shield. */
function canParry() {
    return state.className === "spellblade" && (state.level >= 3 || subclassIs("spellguard")) && equippedWeapons().length > 0;
}

const parryDice = () => `${state.shield ? 2 : 1}d${weaponDie()}`;

function renderDamageOptions() {
    $("halveDamageLabel").textContent = spellfuryActive()
        ? "Halve damage (Spellfury: only against spells)"
        : "Halve damage (saved, Slippery, Uncanny Dodge, Last Bastion…)";

    $("parryRow").classList.toggle("hidden", !canParry());
    $("parryLabel").textContent = `Parry: roll ${parryDice()} and take that much less${state.shield ? " (shield)" : ""}`;
}

function healthAmount() {
    return parseInt(healthAmountInput.value, 10);
}

$("hpManagerButton").addEventListener("click", () => {
    healthAmountInput.value = 1;

    // Spellfury halves damage from spells, which is most of what hits a Spellblade in it
    $("halveDamageInput").checked = spellfuryActive();
    $("parryInput").checked = false;
    $("damageMessage").textContent = "";

    renderDamageOptions();
    renderHP();
    show(hpManagerOverlay);
});

$("closeHPManager").addEventListener("click", () => hide(hpManagerOverlay));

$("damageHPButton").addEventListener("click", async () => {
    const amount = healthAmount();

    if (Number.isNaN(amount) || amount < 0) {
        return;
    }

    const halve = $("halveDamageInput").checked;
    const halved = halve ? Math.floor(amount / 2) : amount;
    let parried = 0;

    if (canParry() && $("parryInput").checked) {
        hide(hpManagerOverlay);

        const rolls = await rollDice(parryDice());

        show(hpManagerOverlay);

        if (!rolls) {
            return;
        }

        parried = sum(rolls);

        // Once per round
        $("parryInput").checked = false;
    }

    const { reduced, absorbed, taken } = updateCurrentHealth(-amount, {
        beforeWard: () => Math.max(0, halved - parried),
        afterWard: $("applyArmorInput").checked ? armorReduces(effectiveArmor()) : damage => damage
    });

    const parts = [];

    if (halve) {
        parts.push(`Halved to ${halved}.`);
    }

    if (parried) {
        parts.push(reduced === 0 ? `Parried ${parried}: no damage!` : `Parried ${parried}.`);
    }

    if (absorbed) {
        parts.push(`Ward absorbed ${absorbed}.`);
    }

    const passed = reduced - absorbed;

    if (passed > 0) {
        parts.push(taken === passed ? `Took ${taken} damage.` : `Took ${taken} damage (${passed} before armor).`);
    }

    if (amount > 0 && reduced === 0 && parried && hasFeat("arcaneRiposte")) {
        parts.push("Arcane Riposte: make a level 1 weapon attack against the attacker.");
    }

    if (amount > 0 && reduced === 0 && parried && subclassIs("spellguard") && state.level >= 5) {
        parts.push(`Absorb: if it was a spell, draw ${halved} tiles.`);
    }

    $("damageMessage").textContent = parts.join(" ") || "No damage.";

    addLog("Damage", `${$("damageMessage").textContent} HP ${state.currentHealth} / ${state.maxHealth}`);
});

$("healHPButton").addEventListener("click", () => {
    const amount = healthAmount();

    if (!Number.isNaN(amount) && amount > 0) {
        updateCurrentHealth(amount);

        $("damageMessage").textContent = `Healed ${amount}.`;

        addLog("Healing", `Healed ${amount}. HP ${state.currentHealth} / ${state.maxHealth}`);
    }
});

wardInput.addEventListener("input", () => {
    state.ward = Math.max(0, parseInt(wardInput.value, 10) || 0);
    commit("Changed the ward");
});

const constructName = () => state.construct.name.trim() || "Construct";

/*
 * =========================================================
 * MAIN SCREEN STATS
 * =========================================================
 */

function classLine() {
    const subclass = characterClass().subclasses[state.subclass];
    const line = `Level ${state.level} ${characterClass().name}`;

    return subclass && state.level >= SUBCLASS_LEVEL ? `${line} · ${subclass.name}` : line;
}

function renderStats() {
    $("characterNameDisplay").textContent = state.name.trim() || "Unnamed adventurer";
    $("characterClassDisplay").textContent = classLine();

    $("guardDCDisplay").textContent = guardDC(state.level);
    $("armorDisplay").textContent = `Armor ${effectiveArmor()}`;
    $("guardBox").title = `Guard DC ${guardDC(state.level)}: the DC when an enemy aims a spell or mundane action at you. ` +
        `The DM can raise it by 1 or 2 when the attack suits you poorly, or lower it when it exploits a weakness.\n\n` +
        `Armor ${effectiveArmor()}: reduces every instance of damage, to a minimum of 1.`;
    $("initiativeDisplay").textContent = formatModifier(initiativeBonus());
    $("passiveRevealDisplay").textContent = passiveReveal();
    $("movementDisplay").replaceChildren(String(movementSpeed()), element("span", "stat-unit", " ft"));

    $("shortRestsDisplay").textContent = `${state.shortRests} / 2`;

    for (const button of document.querySelectorAll(".school-button")) {
        const school = button.dataset.school;
        const schoolRank = rank(school);

        button.replaceChildren(
            element("span", null, schoolName(school)),
            element("span", "school-rank", "")
        );

        button.lastChild.append(element("small", null, poolNotation(schoolRank)), ` ${schoolRank}`);
        button.title = `${schoolName(school)}: rank ${schoolRank}, roll ${poolNotation(schoolRank)}`;
    }
}

/*
 * =========================================================
 * INITIATIVE
 * =========================================================
 */

$("initiativeButton").addEventListener("click", async () => {
    const rolls = await rollDice("1d20");

    if (!rolls) {
        return;
    }

    const rows = [
        ["d20", rolls[0]],
        [hasFeat("alert") ? "Move rank + 5 (Alert)" : "Move rank", formatModifier(initiativeBonus())],
        ["Initiative", rolls[0] + initiativeBonus()]
    ];

    showInfoResult("Initiative", rows);
});

/*
 * =========================================================
 * RESTING
 * =========================================================
 */

$("shortRestButton").addEventListener("click", async () => {
    if (state.shortRests >= 2) {
        showInfoResult("Short Rest", [["Short rests today", "2 / 2"], ["", "Take a long rest first"]], null, { log: false });

        return;
    }

    const count = Math.ceil(state.level / 2);
    const hitDie = characterClass().hitDie;
    const rolls = await rollDice(`${count}d${hitDie}`);

    if (!rolls) {
        return;
    }

    const medic = hasFeat("medic") ? state.level : 0;
    const healing = sum(rolls) + medic;

    state.shortRests++;
    updateCurrentHealth(healing, { label: "Short rest" });

    const rows = [[`Hit dice (${count}d${hitDie})`, sum(rolls)]];

    if (medic) {
        rows.push(["Medic", `+${medic}`]);
    }

    rows.push(["Healed", healing], ["HP", `${state.currentHealth} / ${state.maxHealth}`]);

    // Constructs only recover during short rests with Field Repairs
    if (hasFieldRepairs()) {
        rows.push(...await restConstruct(count, hitDie, medic));
    }

    showInfoResult("Short Rest", rows, { title: "Hit dice", values: rolls });
});

/*
 * With Field Repairs, a construct recovers during short rests like you do:
 * its own roll of your hit dice. A Clockmaker's small constructs share that
 * one roll, the most damaged first. Destroyed ones wait for a long rest.
 * Returns the rows for the rest's result.
 */
async function restConstruct(count, hitDie, medic) {
    const parts = constructParts();
    const name = parts.length > 1 ? `${constructName()}s` : constructName();
    const rows = [];

    const damaged = parts.filter(part => !part.destroyed && part.damage > 0);

    if (damaged.length) {
        const rolls = await rollDice(`${count}d${hitDie}`);

        if (rolls) {
            let healing = sum(rolls) + medic;

            rows.push([`${name} healed`, healing]);

            for (const part of damaged.sort((a, b) => b.damage - a.damage)) {
                const healed = Math.min(part.damage, healing);

                part.damage -= healed;
                healing -= healed;
            }
        }
    }

    // The same undo step as the rest itself
    commit("Short rest", { merge: true });

    if (rows.length) {
        rows.push(...parts.map((part, index) => [
            `${parts.length > 1 ? `${constructName()} ${index + 1}` : constructName()} HP`,
            part.destroyed ? "Destroyed" : `${partHealth(part)} / ${partMaxHealth()}`
        ]));
    }

    return rows;
}

$("longRestButton").addEventListener("click", async () => {
    if (preference("confirmLongRest")) {
        const confirmed = await confirmAction(
            "Long Rest",
            "Take a long rest? You regain all hit points and your signature ability's uses.",
            "Rest"
        );

        if (!confirmed) {
            return;
        }
    }

    state.currentHealth = state.maxHealth;
    state.ward = 0;
    state.shortRests = 0;
    state.signature = { used: 0, roundsLeft: 0, ongoing: false };

    const rows = [["HP", `${state.currentHealth} / ${state.maxHealth}`]];

    if (signatureHasUses()) {
        rows.push([characterClass().signature.name, "All uses back"]);
    }

    // Runes fade after a long rest, unless they last a week (Lasting Runes) or recharge (Living Workshop)
    if (characterClass().signature.runes && state.runes > 0) {
        if (runesLast()) {
            rows.push(["Runes", hasFeat("livingWorkshop") ? "Kept, used ones recharge" : "Last a week"]);
        } else {
            rows.push(["Runes", "Faded"]);
            state.runes = 0;
        }
    }

    // Constructs heal fully, and destroyed ones can be rebuilt
    if (hasConstruct()) {
        const rebuilt = constructParts().filter(part => part.destroyed).length;

        rows.push([hasHelpers() ? `${constructName()}s` : constructName(), rebuilt ? (hasHelpers() ? `${rebuilt} rebuilt, all at full HP` : "Rebuilt") : "Full HP"]);

        state.construct = {
            ...state.construct,
            damage: 0,
            destroyed: false,
            colossusRounds: 0,
            colossusUsed: false,
            helpers: state.construct.helpers.map(restedHelper)
        };
    }

    resetDeathSaves();
    commit("Long rest", { toast: true });

    showInfoResult("Long Rest", rows);
});

/*
 * =========================================================
 * CHARACTER SETTINGS
 * =========================================================
 *
 * Numbers the rules decide (ranks, mortal limits, max HP, armor) are worked
 * out here rather than typed in, so they can't be entered wrong. Players only
 * make the choices: where rank points go, which gear, and so on.
 */

const characterOverlay = $("characterOverlay");

const nameInput = $("nameInput");
const classInput = $("classInput");
const subclassInput = $("subclassInput");
const levelInput = $("levelInput");
const levelUpButton = $("levelUpButton");
const movementInput = $("movementInput");
const passionNameInput = $("passionNameInput");
const maxHPInput = $("maxHPInput");
const rolledHPInput = $("rolledHPInput");
const armorInput = $("armorInput");
const shieldInput = $("shieldInput");

classInput.replaceChildren(...Object.entries(CLASSES).map(([key, info]) => {
    const option = element("option", null, info.name);

    option.value = key;

    return option;
}));

/* A dropdown of options: [[value, text], ...]. */
function fillSelect(select, options, value) {
    select.replaceChildren(...options.map(([optionValue, text]) => {
        const option = element("option", null, text);

        option.value = optionValue;

        return option;
    }));

    select.value = value;
}

/* Every school except Passion, after a "Choose…" placeholder. */
const schoolOptions = () => [["", "Choose a school"], ...RANKED_SCHOOLS.map(school => [school, schoolName(school)])];

/*
 * =========================================================
 * RANKS
 * =========================================================
 */

/* The rank grid: one row per school, plus Passion, which follows the others. */
const rankRows = {};

for (const school of MAGIC_SCHOOLS) {
    const label = element("span", "rank-school");
    const points = element("span", "counter");
    const bonus = element("span", "result-label");
    const total = element("strong", "rank-total");
    const pool = element("span", "result-label");
    const limit = element("span", "rank-limit");

    const row = { label, bonus, total, pool, limit };

    if (school === "passion") {
        points.append(element("span", "result-label", "—"));
        points.title = "Always 2 higher than your highest other rank, up to 8";
    } else {
        row.minus = element("button", null, "−");
        row.plus = element("button", null, "+");
        row.points = element("strong");

        row.minus.type = "button";
        row.plus.type = "button";
        row.minus.setAttribute("aria-label", `Take a rank point from ${school}`);
        row.plus.setAttribute("aria-label", `Spend a rank point on ${school}`);

        row.minus.addEventListener("click", () => {
            state.rankPoints[school] = Math.max(0, state.rankPoints[school] - 1);
            commit();
        });

        row.plus.addEventListener("click", () => {
            if (canRaiseRank(school)) {
                state.rankPoints[school]++;
                commit();
            }
        });

        points.append(row.minus, row.points, row.plus);
    }

    $("rankGrid").append(label, points, bonus, total, pool, limit);

    rankRows[school] = row;
}

/* The class's "any school" bonus ranks and a Trickster's Expert schools, as dropdowns. */
function renderRankChoices() {
    const container = $("rankChoices");
    const rows = [];

    const addChoices = (title, choices, onChange) => {
        const selects = element("span", "input-with-button");

        choices.forEach((choice, index) => {
            const select = element("select", "modal-input");

            select.setAttribute("aria-label", `${title} ${index + 1}`);
            fillSelect(select, schoolOptions(), choice);
            select.classList.toggle("needs-attention", !choice);
            select.addEventListener("change", () => onChange(index, select.value));

            selects.append(select);
        });

        rows.push(element("span", "settings-label", title), selects);
    };

    if (state.bonusChoices.length) {
        addChoices("Bonus ranks", state.bonusChoices, (index, school) => {
            state.bonusChoices[index] = school;
            commit();
        });
    }

    if (state.expertSchools.length) {
        addChoices("Expert", state.expertSchools, (index, school) => {
            state.expertSchools[index] = school;
            commit();
        });
    }

    container.replaceChildren(...rows);
    container.classList.toggle("hidden", rows.length === 0);
}

function renderRanks() {
    const cap = rankCap(state.level);
    const left = rankPointsLeft();
    const overCap = schoolsOverCap();

    if (left < 0) {
        $("rankSummary").textContent = `${-left} too many points spent · cap ${cap}`;
    } else if (unspentRanks()) {
        $("rankSummary").textContent = `${left} ${left === 1 ? "point" : "points"} to spend · cap ${cap}`;
    } else {
        $("rankSummary").textContent = `All points spent · cap ${cap} at level ${state.level}`;
    }

    $("rankSummary").classList.toggle("warning", left < 0 || overCap.length > 0);
    $("rankSummary").classList.toggle("attention", unspentRanks() > 0);

    for (const school of MAGIC_SCHOOLS) {
        const row = rankRows[school];
        const schoolRank = rank(school);

        row.label.textContent = schoolName(school);
        row.total.textContent = schoolRank;
        row.pool.textContent = poolNotation(schoolRank);

        row.limit.textContent = mortalLimit(school);
        row.limit.title = mortalLimitSources(school).join("\n");

        if (school === "passion") {
            row.bonus.textContent = "";
            continue;
        }

        const bonus = classBonus(school);

        row.bonus.textContent = bonus ? `+${bonus}` : "";
        row.points.textContent = state.rankPoints[school];
        row.minus.disabled = state.rankPoints[school] === 0;
        row.plus.disabled = !canRaiseRank(school);
        row.plus.title = rawRank(school) >= cap ? `Rank ${cap} is the cap at level ${state.level}` : "";

        const over = overCap.includes(school);

        row.total.classList.toggle("warning", over);
        row.total.title = over ? `${rawRank(school) - cap} over the cap: those ranks do nothing. Move the points elsewhere.` : "";
    }

    renderRankChoices();
}

/*
 * =========================================================
 * IDENTITY, HEALTH AND EQUIPMENT
 * =========================================================
 */

function renderSubclassOptions() {
    const unlocked = state.level >= SUBCLASS_LEVEL;

    const options = [["", unlocked ? "Choose a subclass" : "Chosen at level 2"]];

    if (unlocked) {
        for (const [key, subclass] of Object.entries(characterClass().subclasses)) {
            options.push([key, subclass.name]);
        }
    }

    fillSelect(subclassInput, options, unlocked ? state.subclass : "");

    subclassInput.disabled = !unlocked;
}

function renderEquipment() {
    setValue(maxHPInput, state.maxHealth);
    maxHPInput.disabled = !state.rolledHP;
    rolledHPInput.checked = state.rolledHP;
    maxHPInput.title = state.rolledHP
        ? `Fixed hit points would give ${calculatedMaxHealth()}`
        : "Highest number on your hit die + 6, plus the fixed number for every level after 1 (and Tough)";

    fillSelect(
        armorInput,
        ARMOR_TYPES.slice(0, maxArmor() + 1).map((name, value) => [value, `${name} (${value})`]),
        state.armor
    );

    $("shieldRow").classList.toggle("hidden", !canUseShield());
    shieldInput.checked = state.shield;

    const extras = [];

    if (hasFeat("ironHide")) extras.push("Iron Hide +1");

    if (hasFeat("duelist")) {
        extras.push(duelistProblem() ? `Duelist: ${duelistProblem()}` : "Duelist +1");
    }

    $("armorNote").textContent = `Armor value ${effectiveArmor()}` + (extras.length ? ` (${extras.join(", ")})` : "");

    $("equippedWeaponsDisplay").textContent = equippedWeapons().map(weapon => `${weapon.name} (d${weaponDie(weapon)})`).join(", ") || "None equipped";

    $("weaponLimitDisplay").textContent = `${weaponMortalLimit()} · ${mortalLimitSources("weapon").join(", ")}`;
}

function renderSettings() {
    const info = characterClass();

    setValue(nameInput, state.name);
    classInput.value = state.className;
    renderSubclassOptions();
    setValue(levelInput, state.level);
    levelUpButton.disabled = state.level >= MAX_LEVEL;
    levelUpButton.title = state.level >= MAX_LEVEL ? `Level ${MAX_LEVEL} is the highest level` : `Go up to level ${state.level + 1}`;
    setValue(movementInput, state.movement);
    setValue(passionNameInput, state.passionName);

    $("classSummary").textContent =
        `${info.role}. Hit die d${info.hitDie} (take ${info.fixedHP} when levelling up). ` +
        `${info.gear} Bonus ranks: ${info.bonusRanks}`;

    renderTongues();
    renderRanks();
    renderEquipment();
}

/*
 * One dropdown per time the character learned a Tongue: two to start, one
 * more per Polyglot. Picking one you already speak makes you fluent in it.
 * Under them, which ones you're fluent in (with their perk) and which you
 * only speak well.
 */
function renderTongues() {
    const container = $("tongueChoices");

    const selects = state.tongues.map((choice, index) => {
        const select = element("select", "modal-input");
        const placeholder = index === 0 ? "Native Tongue" : index === 1 ? "Second Tongue" : "Polyglot: choose a Tongue";

        select.setAttribute("aria-label", index === 0 ? "Native Tongue" : `Tongue ${index + 1}`);

        // A Tongue already spoken elsewhere: picking it here makes you fluent
        const spokenElsewhere = key => index > 0 && state.tongues.some((other, otherIndex) => other === key && otherIndex !== index);

        fillSelect(select, [
            ["", placeholder],
            ...Object.entries(TONGUES)
                .filter(([key]) => key === choice || tongueAllowedAt(key, index))
                .map(([key, tongue]) => [key, spokenElsewhere(key) ? `${tongue.name} (fluent)` : tongue.name])
        ], choice);

        select.classList.toggle("needs-attention", !choice);
        select.title = TONGUES[choice] ? `${TONGUES[choice].perk}: ${TONGUES[choice].text}` : "";

        select.addEventListener("change", () => {
            state.tongues[index] = select.value;
            commit();
        });

        return select;
    });

    const known = knownTongues();
    const names = fluent => known.filter(([, isFluent]) => isFluent === fluent).map(([key]) => TONGUES[key].name).join(", ");
    const summary = element("span", "settings-note tongue-summary");

    if (known.length) {
        summary.append(element("strong", null, "Fluent: "), names(true) || "none");

        if (names(false)) {
            summary.append(" · ", element("strong", null, "Well-spoken: "), `${names(false)} (no perk)`);
        }
    }

    container.replaceChildren(...selects, ...(known.length ? [summary] : []));
}

nameInput.addEventListener("input", () => {
    state.name = nameInput.value.slice(0, 40);
    commit();
});

classInput.addEventListener("change", () => {
    state.className = classInput.value;
    state.subclass = "";
    state.bonusChoices = [];
    state.signature = { used: 0, roundsLeft: 0, ongoing: false };
    commit();
});

subclassInput.addEventListener("change", () => {
    state.subclass = subclassInput.value;
    commit();
});

levelInput.addEventListener("input", () => {
    const value = parseInt(levelInput.value, 10);

    if (!Number.isNaN(value)) {
        state.level = clamp(value, 1, MAX_LEVEL);
        commit();
    }
});

levelInput.addEventListener("change", () => {
    levelInput.value = state.level;
});

levelUpButton.addEventListener("click", () => {
    levelUp();
    commit(`Levelled up to ${state.level}`);
});

movementInput.addEventListener("input", () => {
    const value = parseInt(movementInput.value, 10);

    if (!Number.isNaN(value)) {
        state.movement = Math.max(0, value);
        commit();
    }
});

movementInput.addEventListener("change", () => {
    movementInput.value = state.movement;
});

passionNameInput.addEventListener("input", () => {
    state.passionName = passionNameInput.value.slice(0, 20);
    commit();
});

/* Turning it off goes back to the fixed hit points. */
rolledHPInput.addEventListener("change", () => {
    state.rolledHP = rolledHPInput.checked;
    commit();
});

/* A character at full health stays at full health when max HP changes. */
maxHPInput.addEventListener("input", () => {
    const value = parseInt(maxHPInput.value, 10);

    if (Number.isNaN(value) || value < 1) {
        return;
    }

    const wasAtFullHealth = state.currentHealth === state.maxHealth;

    state.maxHealth = value;
    state.currentHealth = wasAtFullHealth ? value : Math.min(state.currentHealth, value);

    commit();
});

armorInput.addEventListener("change", () => {
    state.armor = Number(armorInput.value);
    commit();
});

shieldInput.addEventListener("change", () => {
    if (!shieldInput.checked) {
        state.shield = false;
        commit();

        return;
    }

    const putAway = equipShield();

    if (putAway.length) {
        commit(`Took up the shield and put away ${putAway.join(" and ")}`, { toast: true });
    } else {
        commit();
    }
});

addNumberPicker(healthAmountInput);
addNumberPicker(wardInput, { min: 0 });

$("characterButton").addEventListener("click", () => {
    renderSettings();
    show(characterOverlay);
});

$("closeCharacter").addEventListener("click", () => hide(characterOverlay));

/*
 * =========================================================
 * RENDERING
 * =========================================================
 */

export function renderCharacter() {
    renderHP();
    renderStats();
    renderSettings();
}

onStateChange(renderCharacter);
