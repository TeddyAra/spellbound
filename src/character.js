import { $, show, hide, clamp, element, formatModifier, setValue, sum } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    characterClass,
    rank,
    rawRank,
    classBonus,
    canRaiseRank,
    rankPointsLeft,
    schoolsOverCap,
    schoolName,
    mortalLimit,
    weaponMortalLimit,
    mortalLimitSources,
    calculatedMaxHealth,
    maxArmor,
    canUseShield,
    allowedWeaponDice,
    baseArmor,
    effectiveArmor,
    initiativeBonus,
    weaponDie,
    hasFeat
} from "./state.js";
import {
    CLASSES,
    RANKED_SCHOOLS,
    MAGIC_SCHOOLS,
    MAX_LEVEL,
    SUBCLASS_LEVEL,
    ARMOR_TYPES,
    WEAPON_TYPES,
    rankCap,
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
 * Damage hits the ward first, then hit points. Damage at 0 HP is a failed
 * death roll; any healing from 0 HP wakes you up and clears them.
 */
export function updateCurrentHealth(amount, reduce = damage => damage) {
    const wasDown = state.currentHealth === 0;
    const result = { absorbed: 0, taken: 0 };

    if (amount < 0) {
        let damage = -amount;

        const wardDamage = Math.min(state.ward, damage);

        state.ward -= wardDamage;

        // Only what gets past the ward is reduced (armor, halving)
        damage = damage > wardDamage ? reduce(damage - wardDamage) : 0;

        result.absorbed = wardDamage;
        result.taken = damage;

        state.currentHealth = clamp(state.currentHealth - damage, 0, state.maxHealth);

        if (wasDown && damage > 0) {
            deathSaveFailed();
        }

        // Every signature ability ends early when you're downed
        if (state.currentHealth === 0) {
            state.signature.roundsLeft = 0;
        }
    } else {
        state.currentHealth = clamp(state.currentHealth + amount, 0, state.maxHealth);
    }

    if (state.currentHealth > 0) {
        resetDeathSaves();
    }

    commit();

    return result;
}

/* Halving first, then armor, which never brings a hit below 1. */
function damageAfterReductions(amount) {
    let damage = amount;

    if ($("halveDamageInput").checked) {
        damage = Math.floor(damage / 2);
    }

    if ($("applyArmorInput").checked && damage > 0) {
        damage = Math.max(1, damage - effectiveArmor());
    }

    return damage;
}

function healthAmount() {
    return parseInt(healthAmountInput.value, 10);
}

$("hpManagerButton").addEventListener("click", () => {
    healthAmountInput.value = 1;
    $("halveDamageInput").checked = false;
    $("damageMessage").textContent = "";

    renderHP();
    show(hpManagerOverlay);
});

$("closeHPManager").addEventListener("click", () => hide(hpManagerOverlay));

$("damageHPButton").addEventListener("click", () => {
    const amount = healthAmount();

    if (Number.isNaN(amount) || amount < 0) {
        return;
    }

    const { absorbed, taken } = updateCurrentHealth(-amount, damageAfterReductions);

    const parts = [];

    if (absorbed) {
        parts.push(`Ward absorbed ${absorbed}.`);
    }

    const passed = amount - absorbed;

    if (passed > 0) {
        parts.push(taken === passed ? `Took ${taken} damage.` : `Took ${taken} damage (${passed} before reductions).`);
    }

    $("damageMessage").textContent = parts.join(" ") || "No damage.";
});

$("healHPButton").addEventListener("click", () => {
    const amount = healthAmount();

    if (!Number.isNaN(amount) && amount > 0) {
        updateCurrentHealth(amount);

        $("damageMessage").textContent = `Healed ${amount}.`;
    }
});

wardInput.addEventListener("input", () => {
    state.ward = Math.max(0, parseInt(wardInput.value, 10) || 0);
    commit();
});

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

    $("armorDisplay").textContent = effectiveArmor();
    $("armorDisplay").classList.toggle("boosted", effectiveArmor() > baseArmor());
    $("initiativeDisplay").textContent = formatModifier(initiativeBonus());
    $("passiveRevealDisplay").textContent = rank("reveal");

    $("weaponNameDisplay").textContent = state.weapon.name.trim() || "Weapon attack";
    $("weaponDieDisplay").textContent = `d${weaponDie()}`;

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
        showInfoResult("Short Rest", [["Short rests today", "2 / 2"], ["", "Take a long rest first"]]);

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
    updateCurrentHealth(healing);

    const rows = [[`Hit dice (${count}d${hitDie})`, sum(rolls)]];

    if (medic) {
        rows.push(["Medic", `+${medic}`]);
    }

    rows.push(["Healed", healing], ["HP", `${state.currentHealth} / ${state.maxHealth}`]);

    showInfoResult("Short Rest", rows, { title: "Hit dice", values: rolls });
});

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
    state.signature = { used: 0, roundsLeft: 0 };

    resetDeathSaves();
    commit();

    showInfoResult("Long Rest", [
        ["HP", `${state.currentHealth} / ${state.maxHealth}`],
        [characterClass().signature.name, characterClass().signature.glyphs ? "Faded" : "All uses back"]
    ]);
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
const passionNameInput = $("passionNameInput");
const maxHPInput = $("maxHPInput");
const rolledHPInput = $("rolledHPInput");
const armorInput = $("armorInput");
const shieldInput = $("shieldInput");
const weaponNameInput = $("weaponNameInput");
const weaponDieInput = $("weaponDieInput");

classInput.replaceChildren(...Object.entries(CLASSES).map(([key, info]) => {
    const option = element("option", null, `${info.name} (${info.role})`);

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
    if (hasFeat("duelist")) extras.push(state.shield ? "Duelist (not with a shield)" : "Duelist +1");

    $("armorNote").textContent = `Armor value ${baseArmor()}` + (extras.length ? ` (${extras.join(", ")})` : "");

    setValue(weaponNameInput, state.weapon.name);

    fillSelect(
        weaponDieInput,
        allowedWeaponDice().map(die => [die, `${WEAPON_TYPES[die]} (d${die})`]),
        state.weapon.die
    );

    $("weaponLimitDisplay").textContent = `${weaponMortalLimit()} · ${mortalLimitSources("weapon").join(", ")}`;
}

function renderSettings() {
    const info = characterClass();

    setValue(nameInput, state.name);
    classInput.value = state.className;
    renderSubclassOptions();
    setValue(levelInput, state.level);
    setValue(passionNameInput, state.passionName);

    $("classSummary").textContent =
        `${info.role}. Hit die d${info.hitDie} (take ${info.fixedHP} when levelling up). ` +
        `${info.gear} Bonus ranks: ${info.bonusRanks}`;

    renderRanks();
    renderEquipment();
}

nameInput.addEventListener("input", () => {
    state.name = nameInput.value.slice(0, 40);
    commit();
});

classInput.addEventListener("change", () => {
    state.className = classInput.value;
    state.subclass = "";
    state.bonusChoices = [];
    state.signature = { used: 0, roundsLeft: 0 };
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
    state.shield = shieldInput.checked;
    commit();
});

weaponNameInput.addEventListener("input", () => {
    state.weapon.name = weaponNameInput.value.slice(0, 30);
    commit();
});

weaponDieInput.addEventListener("change", () => {
    state.weapon.die = Number(weaponDieInput.value);
    commit();
});

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
