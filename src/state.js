import { clamp } from "./dom.js";
import {
    CLASSES,
    RANKED_SCHOOLS,
    MAX_RANK,
    MAX_LEVEL,
    SUBCLASS_LEVEL,
    WEAPON_TYPES,
    ARMOR_TYPES,
    rankCap,
    rankPoints,
    baseSpellSlots,
    biggerDie,
    signatureUses
} from "./rules.js";

export const state = {
    name: "",
    className: "wordweaver",
    subclass: "",
    level: 1,

    passionName: "",

    // Rank points spent per school. Ranks are worked out from these (see rank)
    rankPoints: {
        harm: 0,
        aid: 0,
        change: 0,
        move: 0,
        control: 0,
        reveal: 0,
        create: 0
    },

    // The schools picked for the class's "any school" bonus ranks ("" while not chosen)
    bonusChoices: [],

    // Trickster: the two Expert schools
    expertSchools: [],

    // A school for every time the Trained feat was taken
    trainedSchools: [],

    // Entries: { name, school, level }. An empty slot has no name.
    spellSlots: [],

    // Feat key → how many times it was taken
    feats: {},

    // Index into ARMOR_TYPES, which is also its armor value
    armor: 0,
    shield: false,

    weapon: { name: "Dagger", die: 4 },

    // Max HP follows the class and level, unless the player rolled for it
    rolledHP: false,
    maxHealth: 12,
    currentHealth: 12,
    ward: 0,

    // Signature ability: uses spent since the last long rest (glyphs placed for a Runesmith),
    // and the rounds left while it's active
    signature: { used: 0, roundsLeft: 0 },

    shortRests: 0,

    // At 0 HP (see deathSaves.js)
    deathSaves: { successes: 0, failures: 0 },

    // Entries: { id, name, count }
    inventory: []
};

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

/* A school's name as the player sees it ("Passion" is named after the passion). */
export function schoolName(school) {
    if (school === "passion") {
        return state.passionName?.trim() || "Passion";
    }

    return capitalize(school);
}

/*
 * =========================================================
 * CLASS AND FEATS
 * =========================================================
 */

export const characterClass = () => CLASSES[state.className];

export function subclassIs(key) {
    return state.subclass === key && state.level >= SUBCLASS_LEVEL;
}

export function featCount(key) {
    return Number(state.feats[key]) || 0;
}

export const hasFeat = key => featCount(key) > 0;

/* A class feature by name, once the character's level unlocks it. */
export function hasFeature(name) {
    const subclass = characterClass().subclasses[state.subclass];

    const features = [
        ...characterClass().features,
        ...(state.level >= SUBCLASS_LEVEL && subclass ? subclass.features : [])
    ];

    return features.some(feature => feature.name === name && feature.level <= state.level);
}

/*
 * =========================================================
 * RANKS
 * =========================================================
 */

const sumOf = values => values.reduce((total, value) => total + value, 0);

/* Bonus ranks from the class, fixed and chosen. */
export function classBonus(school) {
    return (characterClass().rankBonus[school] ?? 0)
        + state.bonusChoices.filter(choice => choice === school).length;
}

/* Every school starts at 1, plus rank points and class bonus ranks. Can be above the cap. */
export function rawRank(school) {
    return 1 + state.rankPoints[school] + classBonus(school);
}

/* Passion is always 2 higher than the highest other rank, up to 8. */
export function rank(school) {
    if (school === "passion") {
        return Math.min(MAX_RANK, Math.max(...RANKED_SCHOOLS.map(name => rank(name))) + 2);
    }

    return Math.min(rawRank(school), rankCap(state.level));
}

export const spentRankPoints = () => sumOf(RANKED_SCHOOLS.map(school => state.rankPoints[school]));

/* Negative when the character spent more than they have, e.g. after lowering the level. */
export const rankPointsLeft = () => rankPoints(state.level) - spentRankPoints();

export const canRaiseRank = school => rankPointsLeft() > 0 && rawRank(school) < rankCap(state.level);

/* Schools above the cap: the extra ranks do nothing. */
export const schoolsOverCap = () => RANKED_SCHOOLS.filter(school => rawRank(school) > rankCap(state.level));

/*
 * =========================================================
 * MORTAL LIMITS
 * =========================================================
 *
 * The highest level a mundane action can reach: 3, unless a class feature
 * sets it higher. Features that make it "1 higher" stop at 5.
 */

const raise = (limit, steps) => limit >= 5 ? limit : Math.min(5, limit + steps);

export const trainedCount = school => state.trainedSchools.filter(choice => choice === school).length;

/* The limit set by class features: [limit, feature name]. */
function classLimit(school) {
    const level = state.level;

    if (state.className === "loresinger" && school === "control") return [4, "Silver Tongue"];
    if (state.className === "runesmith" && (school === "change" || school === "create")) return [4, "Handy"];
    if (state.className === "warden" && school === "aid") return [level >= 6 ? 5 : 4, level >= 6 ? "Aegis" : "Bulwark"];
    if (state.className === "trickster" && state.expertSchools.includes(school)) return [level >= 6 ? 5 : 4, "Expert"];

    return [3, null];
}

/* The limit for weapon attacks set by class features: [limit, feature name]. */
function classWeaponLimit() {
    if (state.className === "spellblade") return [state.level >= 6 ? 5 : 4, state.level >= 6 ? "Weapon Mastery" : "Weapon Training"];
    if (state.className === "warden") return [4, "Bulwark"];

    return [3, null];
}

const keeperOfLore = school => school === "reveal" && subclassIs("keeperOfLore") ? 1 : 0;

export function mortalLimit(school) {
    return raise(classLimit(school)[0], trainedCount(school) + keeperOfLore(school));
}

/* Battle Rhythm (Skald) only counts while Battle Hymn lasts. */
const battleRhythm = () => subclassIs("skald") && state.level >= 5 && signatureActive();

/* Weapon attacks are mundane Harm actions, so anything that raises Harm counts too. */
export function weaponMortalLimit() {
    const base = Math.max(classLimit("harm")[0], classWeaponLimit()[0]);

    return raise(base, trainedCount("harm") + (battleRhythm() ? 1 : 0));
}

/* Where a school's mortal limit comes from, for tooltips. */
export function mortalLimitSources(school) {
    const [limit, feature] = school === "weapon"
        ? [Math.max(classLimit("harm")[0], classWeaponLimit()[0]), classLimit("harm")[0] > classWeaponLimit()[0] ? classLimit("harm")[1] : classWeaponLimit()[1]]
        : classLimit(school);

    const sources = [feature ? `${feature}: ${limit}` : "Base: 3"];
    const trained = trainedCount(school === "weapon" ? "harm" : school);

    if (trained) {
        sources.push(`Trained: +${trained}`);
    }

    if (keeperOfLore(school)) {
        sources.push("Well of Stories: +1");
    }

    if (school === "weapon" && battleRhythm()) {
        sources.push("Battle Rhythm: +1");
    }

    if (sources.length > 1) {
        sources.push("(1 higher stops at 5)");
    }

    return sources;
}

/*
 * =========================================================
 * SIGNATURE ABILITY
 * =========================================================
 */

export const maxSignatureUses = () => signatureUses(state.className, state.level)
    + (subclassIs("glyphwarden") ? 1 : 0)
    + (subclassIs("mimic") && state.level >= 10 ? 1 : 0);

export const signatureActive = () => state.signature.roundsLeft > 0;

const signatureOn = className => state.className === className && signatureActive();

/* Torrent of Words: a 4 is a surge too. */
export function surgeThreshold() {
    return signatureOn("wordweaver") ? 4 : 5;
}

/*
 * =========================================================
 * EQUIPMENT
 * =========================================================
 */

/* Martial Training (feat) and War Chant (Skald) allow medium armor and martial weapons. */
const martial = () => hasFeat("martialTraining") || subclassIs("skald");

export const maxArmor = () => Math.max(characterClass().armor, martial() ? 2 : 0);

export const canUseShield = () => Boolean(characterClass().shield) || hasFeat("shieldAdept");

export function allowedWeaponDice() {
    const dice = new Set(characterClass().weapons);

    if (martial()) {
        dice.add(8);
    }

    return [...dice].sort((a, b) => a - b);
}

/* Armor, shield, Iron Hide and Duelist (with no shield), plus Hold the Line while it lasts. */
export function baseArmor() {
    return state.armor
        + (state.shield ? 1 : 0)
        + (hasFeat("ironHide") ? 1 : 0)
        + (hasFeat("duelist") && !state.shield ? 1 : 0);
}

export function effectiveArmor() {
    return baseArmor() + (signatureOn("warden") ? 2 : 0);
}

export function initiativeBonus() {
    return rank("move") + (hasFeat("alert") ? 5 : 0);
}

/* Spellblade: Weapon Mastery makes the weapon die one size bigger. */
export function weaponDie() {
    const masterful = state.className === "spellblade" && state.level >= 6;

    return masterful ? biggerDie(state.weapon.die) : state.weapon.die;
}

/* Spellfury: weapon attacks deal one extra weapon die. */
export const weaponExtraDice = () => signatureOn("spellblade") ? 1 : 0;

/*
 * =========================================================
 * HIT POINTS
 * =========================================================
 */

/* Highest number on the hit die + 6, the fixed number for every later level, and Tough. */
export function calculatedMaxHealth() {
    const info = characterClass();

    return info.hitDie + 6
        + (state.level - 1) * info.fixedHP
        + featCount("tough") * 2 * state.level;
}

/*
 * =========================================================
 * SPELL SLOTS
 * =========================================================
 */

export function spellSlotCount() {
    return baseSpellSlots(state.level)
        + (characterClass().extraSlots ?? 0)
        + (subclassIs("archivist") ? 2 : 0)
        + featCount("extraSlot");
}

export const isEmptySlot = slot => !slot.name.trim();

/* Grows or shrinks the slot list to the number of slots the character has, keeping saved spells. */
export function normalizeSpellSlots() {
    const slots = Array.isArray(state.spellSlots) ? state.spellSlots : [];

    state.spellSlots = Array.from({ length: Math.max(spellSlotCount(), savedSpellCount(slots)) }, (_, index) => {
        const slot = slots[index];

        return {
            name: typeof slot?.name === "string" ? slot.name : "",
            school: RANKED_SCHOOLS.includes(slot?.school) || slot?.school === "passion" ? slot.school : "harm",
            level: clamp(Number(slot?.level) || 1, 1, MAX_RANK)
        };
    });

    // Drop empty slots the character doesn't have (e.g. after lowering the level)
    while (state.spellSlots.length > spellSlotCount() && isEmptySlot(state.spellSlots.at(-1))) {
        state.spellSlots.pop();
    }
}

function savedSpellCount(slots) {
    let last = 0;

    slots.forEach((slot, index) => {
        if (typeof slot?.name === "string" && slot.name.trim()) {
            last = index + 1;
        }
    });

    return last;
}

/*
 * =========================================================
 * PERSISTENCE
 * =========================================================
 */

export const STATE_STORAGE_KEY = "spellboundState";

export function saveState() {
    try {
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Failed to save state:", error);
    }
}

/* A list of `length` schools (or "" for not chosen yet), keeping what was picked. */
function schoolChoices(choices, length) {
    return Array.from({ length }, (_, index) => {
        const choice = Array.isArray(choices) ? choices[index] : "";

        return RANKED_SCHOOLS.includes(choice) ? choice : "";
    });
}

/* Keeps every value in range, e.g. after loading a save or changing level. */
export function normalizeState() {
    if (!CLASSES[state.className]) {
        state.className = "wordweaver";
    }

    if (!characterClass().subclasses[state.subclass]) {
        state.subclass = "";
    }

    state.level = clamp(Number(state.level) || 1, 1, MAX_LEVEL);

    // Points are never taken away automatically: spending too many is shown as a reminder instead
    for (const school of RANKED_SCHOOLS) {
        state.rankPoints[school] = Math.max(0, Math.floor(Number(state.rankPoints[school]) || 0));
    }

    state.bonusChoices = schoolChoices(state.bonusChoices, characterClass().bonusChoices ?? 0);
    state.expertSchools = schoolChoices(state.expertSchools, state.className === "trickster" ? 2 : 0);
    state.trainedSchools = schoolChoices(state.trainedSchools, featCount("trained"));

    state.armor = clamp(Math.floor(Number(state.armor) || 0), 0, Math.min(maxArmor(), ARMOR_TYPES.length - 1));
    state.shield = Boolean(state.shield) && canUseShield();

    const weaponDice = allowedWeaponDice();

    state.weapon = {
        name: typeof state.weapon?.name === "string" ? state.weapon.name : "",
        die: WEAPON_TYPES[state.weapon?.die] && weaponDice.includes(Number(state.weapon.die))
            ? Number(state.weapon.die)
            : weaponDice[0]
    };

    state.rolledHP = Boolean(state.rolledHP);

    // Following the class and level, a character at full health stays at full health
    if (!state.rolledHP && state.maxHealth !== calculatedMaxHealth()) {
        const wasAtFullHealth = state.currentHealth === state.maxHealth;

        state.maxHealth = calculatedMaxHealth();

        if (wasAtFullHealth) {
            state.currentHealth = state.maxHealth;
        }
    }

    state.maxHealth = Math.max(1, Math.floor(Number(state.maxHealth) || 1));
    state.currentHealth = clamp(Number(state.currentHealth) || 0, 0, state.maxHealth);
    state.ward = Math.max(0, Number(state.ward) || 0);

    state.signature = {
        used: clamp(Number(state.signature?.used) || 0, 0, maxSignatureUses()),
        roundsLeft: clamp(Number(state.signature?.roundsLeft) || 0, 0, 3)
    };

    state.deathSaves = {
        successes: clamp(Number(state.deathSaves?.successes) || 0, 0, 3),
        failures: clamp(Number(state.deathSaves?.failures) || 0, 0, 3)
    };

    state.inventory = Array.isArray(state.inventory)
        ? state.inventory.filter(item => typeof item?.name === "string")
        : [];

    normalizeSpellSlots();
}

/* Saves from before rank points stored the ranks themselves. */
function rankPointsFromRanks(saved) {
    const bonus = CLASSES[saved.className]?.rankBonus ?? {};

    return Object.fromEntries(RANKED_SCHOOLS.map(school => [
        school,
        Math.max(0, (Number(saved.ranks[school]) || 1) - 1 - (bonus[school] ?? 0))
    ]));
}

export function loadState() {
    const savedState = localStorage.getItem(STATE_STORAGE_KEY);

    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            const defaultPoints = { ...state.rankPoints };

            if (parsedState.ranks && !parsedState.rankPoints) {
                parsedState.rankPoints = rankPointsFromRanks(parsedState);
            }

            Object.assign(state, parsedState);

            state.rankPoints = { ...defaultPoints, ...parsedState.rankPoints };
            state.feats = { ...parsedState.feats };

            delete state.ranks;
            delete state.mortalLimits;
        } catch (error) {
            console.error("Failed to load saved state:", error);
        }
    }

    normalizeState();
}

/*
 * =========================================================
 * CHANGES
 * =========================================================
 */

/* Call after changing the state: keeps it valid, saves it, and tells every panel to redraw. */
export function commit() {
    normalizeState();
    saveState();

    document.dispatchEvent(new Event("statechange"));
}

export function onStateChange(render) {
    document.addEventListener("statechange", render);
}
