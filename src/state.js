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
    signatureUses,
    runesAllowed,
    constructFrame,
    MODULES,
    TONGUES,
    STARTING_TONGUES
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

    // Tongues known (see TONGUES in rules.js), "" while not chosen. The first is the native Tongue.
    tongues: [],

    // Entries: { name, school, level }. An empty slot has no name.
    spellSlots: [],

    // Feat key → how many times it was taken
    feats: {},

    // Index into ARMOR_TYPES, which is also its armor value
    armor: 0,
    shield: false,

    weapon: { name: "Dagger", die: 4, ranged: false, twoHanded: false },

    // Max HP follows the class and level, unless the player rolled for it
    rolledHP: false,
    maxHealth: 12,
    currentHealth: 12,
    ward: 0,

    // Signature ability: uses spent since the last long rest,
    // and the rounds left while it's active. One that lasts until the end of the combat
    // (Spellfury) is `ongoing` instead, until it's clicked off.
    signature: { used: 0, roundsLeft: 0, ongoing: false },

    // Runesmith: runes out at once
    runes: 0,

    // Golemwright: the construct companion (see construct.js), and its modules (see MODULES). Damage is kept rather than hit points,
    // so it keeps up when its maximum changes (a new level, Colossus). Destroyed at 0 HP until the next long rest.
    // A Clockmaker's small constructs are `helpers` instead, each { damage, destroyed } (see constructParts).
    construct: { name: "", damage: 0, destroyed: false, colossusRounds: 0, colossusUsed: false, modules: [], helpers: [] },

    shortRests: 0,

    // At 0 HP (see deathSaves.js)
    deathSaves: { successes: 0, failures: 0 },

    // Entries: { id, name, count }
    inventory: [],

    // The letter tiles on the table (see tiles.js). Entries: { letter, x, y, rotation, z }
    board: [],

    // The action panel, while it's open (see casting.js): { school, mode, slotIndex, level, highest, precise, split }
    action: null,

    // What happened, newest first (see log.js). Entries: { at, title, detail, dice }
    log: [],

    // When the character was made, last really changed, and last exported to a file (see exportReminder)
    createdAt: 0,
    changedAt: 0,
    lastExported: 0
};

// A fresh character, for filling in whatever a save or file leaves out
const DEFAULT_STATE = structuredClone(state);

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

/* Runesmith (Lettered): only Reveal actions to read, decipher or spot writing, symbols and traps. */
export const canBeLettered = school => state.className === "runesmith" && school === "reveal";

/* The limit set by class features: [limit, feature name]. */
function classLimit(school, lettered = false) {
    const level = state.level;

    if (state.className === "loresinger" && school === "control") return [4, "Silver Tongue"];
    if (state.className === "golemwright" && (school === "change" || school === "create")) return [4, "Handy"];
    if (lettered && canBeLettered(school)) return [4, "Lettered"];
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

export function mortalLimit(school, lettered = false) {
    return raise(classLimit(school, lettered)[0], trainedCount(school) + keeperOfLore(school));
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

    if (canBeLettered(school)) {
        sources.push("Lettered: 4 for writing, symbols and traps");
    }

    return sources;
}

/*
 * =========================================================
 * SIGNATURE ABILITY
 * =========================================================
 */

export const maxSignatureUses = () => signatureUses(state.level)
    + (subclassIs("mimic") && state.level >= 10 ? 1 : 0);

/* Written Word and Construct have no uses: the Runesmith counts runes, the Golemwright has its construct. */
export const signatureHasUses = () => !characterClass().signature.runes && !characterClass().signature.construct;

export const signatureActive = () => state.signature.roundsLeft > 0 || state.signature.ongoing;

const signatureOn = className => state.className === className && signatureActive();

/* Ends the signature ability, e.g. when downed or when the combat ends. */
export function endSignature() {
    state.signature.roundsLeft = 0;
    state.signature.ongoing = false;
}

/* Torrent of Words: a 4 is a surge too. */
export function surgeThreshold() {
    return signatureOn("wordweaver") ? 4 : 5;
}

/* Spellfury: weapon attacks deal one extra weapon die, and spells deal half damage. */
export const spellfuryActive = () => signatureOn("spellblade");

/* Skald (War Chant): your own Battle Hymn adds a die to your pool and 1d4 to your weapon attacks. */
export const battleHymnOnSelf = () => subclassIs("skald") && signatureOn("loresinger");

/*
 * =========================================================
 * RUNES (Runesmith) AND CONSTRUCT (Golemwright)
 * =========================================================
 */

/* Lasting Runes (Runewarden): 1 more. Living Workshop: 2 more. */
export const maxRunes = () => runesAllowed(state.level)
    + (subclassIs("runewarden") ? 1 : 0)
    + (hasFeat("livingWorkshop") ? 2 : 0);

/* Runes that outlast a long rest: a week with Lasting Runes, recharging with Living Workshop. */
export const runesLast = () => subclassIs("runewarden") || hasFeat("livingWorkshop");

export const hasConstruct = () => state.className === "golemwright";

export const maxModules = () => constructFrame(state.level).modules;

/* The modules the construct can choose from: Spare Parts adds three. */
export const availableModules = () => Object.keys(MODULES).filter(key => !MODULES[key].spareParts || hasFeat("spareParts"));

export const hasModule = key => state.construct.modules.includes(key);

export const constructHasToolkit = () => hasModule("toolkit");

export const colossusActive = () => state.construct.colossusRounds > 0;

/* 10 + 3 per level, and 2 more per level with Reinforced Construct. Before Colossus. */
export function constructBaseHealth() {
    return 10 + (hasFeat("reinforcedConstruct") ? 5 : 3) * state.level;
}

/* Colossus doubles it. */
export const constructMaxHealth = () => constructBaseHealth() * (colossusActive() ? 2 : 1);

export const constructHealth = () => state.construct.destroyed ? 0 : constructMaxHealth() - state.construct.damage;

/*
 * Little Helpers (Clockmaker): small constructs up to the Create rank instead
 * of one. They split the construct's hit points evenly, rounding down, and
 * are destroyed and rebuilt one at a time.
 */
export const hasHelpers = () => hasConstruct() && subclassIs("clockmaker");

export const maxHelpers = () => Math.max(1, rank("create"));

/*
 * Everything that has its own hit points: each small construct, or the one
 * construct. Each part is { damage, destroyed }.
 */
export const constructParts = () => hasHelpers() ? state.construct.helpers : [state.construct];

export const partMaxHealth = () => hasHelpers()
    ? Math.max(1, Math.floor(constructMaxHealth() / state.construct.helpers.length))
    : constructMaxHealth();

export const partHealth = part => part.destroyed ? 0 : partMaxHealth() - part.damage;

/* Can't attack or act once every part is destroyed. */
export const constructDown = () => constructParts().every(part => part.destroyed);

export const partsStanding = () => constructParts().filter(part => !part.destroyed).length;

/* A fresh small construct, at full hit points. */
export const newHelper = () => ({ damage: 0, destroyed: false });

/*
 * When Colossus ends, the extra hit points go first: what's left of its
 * damage can't take it below 1 hit point. Doesn't save or redraw.
 */
export function endColossus() {
    state.construct.colossusRounds = 0;
    state.construct.damage = Math.min(state.construct.damage, constructBaseHealth() - 1);
}

/* 1, and 1 more each from Plating, Reinforced Construct and Heavy Frame (Warforger). */
export function constructArmor() {
    return 1
        + (hasModule("plating") ? 1 : 0)
        + (hasFeat("reinforcedConstruct") ? 1 : 0)
        + (subclassIs("warforger") ? 1 : 0);
}

/* Upgraded Frame and Grand Engine raise its rank and die (see constructFrame). Colossus makes the die one size bigger. */
export const constructRank = () => constructFrame(state.level).rank;

export function constructDie() {
    const die = constructFrame(state.level).die;

    return colossusActive() ? biggerDie(die) : die;
}

/* Colossus (Warforger, level 10). */
export const canColossus = () => subclassIs("warforger") && state.level >= 10;

/* Field Repairs (level 3): mundane Change and Create actions repair it, and it can be rebuilt during a short rest. */
export const hasFieldRepairs = () => hasConstruct() && state.level >= 3;

/*
 * =========================================================
 * EQUIPMENT
 * =========================================================
 */

/* Martial Training (feat), War Chant (Skald) and Carved Arms (Runecarver) allow medium armor and martial weapons. */
const martial = () => hasFeat("martialTraining") || subclassIs("skald") || subclassIs("runecarver");

export const maxArmor = () => Math.max(characterClass().armor, martial() ? 2 : 0);

export const canUseShield = () => Boolean(characterClass().shield) || hasFeat("shieldAdept");

export function allowedWeaponDice() {
    const dice = new Set(characterClass().weapons);

    if (martial()) {
        dice.add(8);
    }

    return [...dice].sort((a, b) => a - b);
}

/* Armor, shield, Iron Hide, and Duelist (one one-handed weapon, so no shield or two-handed weapon). */
export function effectiveArmor() {
    return state.armor
        + (state.shield ? 1 : 0)
        + (hasFeat("ironHide") ? 1 : 0)
        + (hasFeat("duelist") && !state.shield && !state.weapon.twoHanded ? 1 : 0);
}

export function initiativeBonus() {
    return rank("move") + (hasFeat("alert") ? 5 : 0);
}

/* Arcane Archer: Enchanted Arrows makes a ranged weapon die one size bigger. */
export const enchantedArrows = () => subclassIs("arcaneArcher") && state.weapon.ranged;

/* Spellblade: Weapon Mastery and Enchanted Arrows each make the weapon die one size bigger. */
export function weaponDie() {
    const masterful = state.className === "spellblade" && state.level >= 6;

    return biggerDie(state.weapon.die, (masterful ? 1 : 0) + (enchantedArrows() ? 1 : 0));
}

/* Spellfury: weapon attacks deal one extra weapon die. */
export const weaponExtraDice = () => spellfuryActive() ? 1 : 0;

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

// Every character has its own entry, and the roster says which ones there are: { current, ids }
const ROSTER_KEY = "spellboundRoster";
const characterKey = id => `spellboundCharacter:${id}`;

// From before there could be several characters. Copied once, and left alone as a backup.
const OLD_STATE_KEY = "spellboundState";

let roster = { current: null, ids: [] };

const newCharacterId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function saveRoster() {
    try {
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    } catch (error) {
        console.error("Failed to save the characters:", error);
    }
}

export function saveState() {
    try {
        localStorage.setItem(characterKey(roster.current), JSON.stringify(state));
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

/* Two Tongues, and one more for every time Polyglot was taken, up to every Tongue there is. */
export const tongueCount = () => Math.min(Object.keys(TONGUES).length, STARTING_TONGUES + featCount("polyglot"));

/* A list of `length` Tongues (or "" for not chosen yet), keeping what was picked and never one twice. */
function tongueChoices(choices, length) {
    const seen = new Set();

    return Array.from({ length }, (_, index) => {
        const choice = Array.isArray(choices) ? choices[index] : "";

        if (!TONGUES[choice] || seen.has(choice)) {
            return "";
        }

        seen.add(choice);

        return choice;
    });
}

const isNumber = value => typeof value === "number" && Number.isFinite(value);

/* The tiles a save can really show: a letter (or "_" for a blank) and a place on the table. */
export function normalizeBoard(board) {
    if (!Array.isArray(board)) {
        return [];
    }

    return board
        .filter(tile => /^[A-Z_]$/.test(tile?.letter) && isNumber(tile.x) && isNumber(tile.y))
        .map(tile => ({
            letter: tile.letter,
            x: tile.x,
            y: tile.y,
            rotation: isNumber(tile.rotation) ? tile.rotation : 0,
            z: isNumber(tile.z) ? tile.z : 20
        }));
}

const ACTION_MODES = ["spell", "saved", "mundane", "weapon", "constructWeapon", "constructAction"];

/* The open action panel, or null if a save's doesn't make sense. */
export function normalizeAction(action) {
    if (!action || !ACTION_MODES.includes(action.mode) || !Number.isInteger(action.level) || action.level < 1) {
        return null;
    }

    const split = Array.isArray(action.split) && action.split.every(dice => Number.isInteger(dice) && dice > 0)
        && sumOf(action.split) === action.level
        ? action.split
        : [action.level];

    return {
        school: action.school,
        mode: action.mode,
        slotIndex: Number.isInteger(action.slotIndex) ? action.slotIndex : null,
        level: action.level,
        highest: Number(action.highest) || 0,
        precise: Boolean(action.precise),
        split
    };
}

/* Keeps every value in range, e.g. after loading a save or changing level. */
export function normalizeState() {
    state.board = normalizeBoard(state.board);
    state.action = normalizeAction(state.action);

    state.log = Array.isArray(state.log)
        ? state.log.filter(entry => typeof entry?.title === "string").slice(0, LOG_LIMIT)
        : [];

    state.createdAt = Number(state.createdAt) || 0;
    state.changedAt = Number(state.changedAt) || 0;
    state.lastExported = Number(state.lastExported) || 0;

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
    state.tongues = tongueChoices(state.tongues, tongueCount());

    state.armor = clamp(Math.floor(Number(state.armor) || 0), 0, Math.min(maxArmor(), ARMOR_TYPES.length - 1));
    state.shield = Boolean(state.shield) && canUseShield();

    const weaponDice = allowedWeaponDice();

    state.weapon = {
        name: typeof state.weapon?.name === "string" ? state.weapon.name : "",
        die: WEAPON_TYPES[state.weapon?.die] && weaponDice.includes(Number(state.weapon.die))
            ? Number(state.weapon.die)
            : weaponDice[0],
        ranged: Boolean(state.weapon?.ranged),
        twoHanded: Boolean(state.weapon?.twoHanded)
    };

    // A two-handed weapon leaves no hand for a shield
    if (state.weapon.twoHanded) {
        state.shield = false;
    }

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

    const signature = characterClass().signature;
    const ongoing = Boolean(state.signature?.ongoing) && Boolean(signature.untilCombatEnds);

    state.signature = {
        used: signatureHasUses() ? clamp(Number(state.signature?.used) || 0, 0, maxSignatureUses()) : 0,
        roundsLeft: clamp(Number(state.signature?.roundsLeft) || 0, 0, signature.rounds ?? 0),
        ongoing
    };

    state.runes = state.className === "runesmith" ? clamp(Number(state.runes) || 0, 0, maxRunes()) : 0;

    const construct = state.construct ?? {};
    const available = availableModules();

    state.construct = {
        name: typeof construct.name === "string" ? construct.name : "",
        destroyed: Boolean(construct.destroyed),
        colossusRounds: canColossus() ? clamp(Number(construct.colossusRounds) || 0, 0, 3) : 0,
        colossusUsed: Boolean(construct.colossusUsed),

        // Each module once, only ones it can have, and no more than the frame allows
        modules: [...new Set(Array.isArray(construct.modules) ? construct.modules : [])]
            .filter(key => available.includes(key))
            .slice(0, maxModules())
    };

    state.construct.damage = state.construct.destroyed ? 0 : clamp(Math.floor(Number(construct.damage) || 0), 0, constructMaxHealth());

    // Little Helpers: as many as the Create rank allows, all of them when first chosen.
    // A living one never drops to 0 just because its share of hit points shrank.
    const helpers = Array.isArray(construct.helpers) ? construct.helpers : [];

    state.construct.helpers = (helpers.length ? helpers : Array.from({ length: maxHelpers() }, newHelper))
        .slice(0, maxHelpers())
        .map(helper => ({ damage: Math.floor(Number(helper?.damage) || 0), destroyed: Boolean(helper?.destroyed) }));

    for (const helper of state.construct.helpers) {
        helper.damage = helper.destroyed ? 0 : clamp(helper.damage, 0, partMaxHealth() - 1);
    }

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

/*
 * Saves from before version 0.3, when the Runesmith also built constructs:
 * a Golemwright subclass becomes the Golemwright class, and Glyphwardens
 * become Runewardens. Glyphs are part of runes now.
 */
function migrateRunesmith(saved) {
    if (saved.className !== "runesmith") {
        return;
    }

    if (saved.subclass === "golemwright") {
        saved.className = "golemwright";
        saved.subclass = "";
        saved.runes = 0;
        saved.bonusChoices = [];
    } else if (saved.subclass === "glyphwarden") {
        saved.subclass = "runewarden";
    }

    saved.signature = { used: 0, roundsLeft: 0, ongoing: false };
}

/* Replaces the whole character with saved data, filling in anything it's missing with the defaults. */
function applySaved(saved) {
    if (saved.ranks && !saved.rankPoints) {
        saved.rankPoints = rankPointsFromRanks(saved);
    }

    migrateRunesmith(saved);

    const defaults = structuredClone(DEFAULT_STATE);

    for (const key of Object.keys(state)) {
        delete state[key];
    }

    Object.assign(state, defaults, saved);

    state.rankPoints = { ...defaults.rankPoints, ...saved.rankPoints };
    state.feats = { ...saved.feats };
    state.construct = { ...defaults.construct, ...saved.construct };

    delete state.ranks;
    delete state.mortalLimits;
}

/* Reads a stored character. Null if there's none, or it's damaged. */
function readCharacter(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        console.error("Failed to load saved state:", error);

        return null;
    }
}

export function loadState() {
    const saved = readCharacter(ROSTER_KEY);

    undoSteps.length = 0;
    baseline = null;

    if (Array.isArray(saved?.ids) && saved.ids.length) {
        roster = { current: saved.ids.includes(saved.current) ? saved.current : saved.ids[0], ids: saved.ids };

        applySaved(readCharacter(characterKey(roster.current)) ?? {});
    } else {
        // The first visit, or the first since there could be several characters
        const id = newCharacterId();

        roster = { current: id, ids: [id] };

        applySaved(readCharacter(OLD_STATE_KEY) ?? {});
        saveRoster();
    }

    state.createdAt ||= Date.now();

    normalizeState();
    saveState();
}

/*
 * =========================================================
 * SEVERAL CHARACTERS (see characters.js)
 * =========================================================
 */

/* Every character, for the switcher: the current one as it is now, the others as they were saved. */
export function listCharacters() {
    return roster.ids.map(id => {
        const character = id === roster.current ? state : readCharacter(characterKey(id)) ?? {};

        return {
            id,
            current: id === roster.current,
            name: typeof character.name === "string" ? character.name : "",
            className: character.className,
            subclass: character.subclass,
            level: Number(character.level) || 1,
            lastExported: Number(character.lastExported) || 0,
            exportDue: exportDue(character)
        };
    });
}

/* Puts this data on the table as the character `id`, with an empty undo list. */
function becomeCharacter(id, character) {
    roster.current = id;

    applySaved(character);

    state.createdAt ||= Date.now();

    normalizeState();
    saveRoster();
    saveState();

    undoSteps.length = 0;
    baseline = JSON.stringify(state);

    notifyStateChange();
}

/* Adds a character (blank, or from a file) and switches to it. The current one stays saved. */
export function addCharacter(character = {}) {
    saveState();

    const id = newCharacterId();

    roster.ids.push(id);
    becomeCharacter(id, structuredClone(character));
}

export function switchCharacter(id) {
    if (id === roster.current || !roster.ids.includes(id)) {
        return;
    }

    saveState();
    becomeCharacter(id, readCharacter(characterKey(id)) ?? {});
}

/* Removes a character for good. Removing the last one leaves a blank one. */
export function deleteCharacter(id) {
    if (!roster.ids.includes(id)) {
        return;
    }

    roster.ids = roster.ids.filter(other => other !== id);

    try {
        localStorage.removeItem(characterKey(id));
    } catch (error) {
        console.error("Failed to delete the character:", error);
    }

    if (!roster.ids.length) {
        const blank = newCharacterId();

        roster.ids = [blank];
        becomeCharacter(blank, {});
    } else if (id === roster.current) {
        becomeCharacter(roster.ids[0], readCharacter(characterKey(roster.ids[0])) ?? {});
    } else {
        saveRoster();
    }
}

/*
 * =========================================================
 * CHARACTER FILES
 * =========================================================
 */

const FILE_FORMAT = "spellbound-character";

/* A character as a file's contents (see characters.js). */
export function exportCharacter(id = roster.current) {
    const character = id === roster.current ? state : readCharacter(characterKey(id));

    return JSON.stringify({ format: FILE_FORMAT, version: 1, character }, null, 2);
}

/* Reads a character file. Throws if it isn't one, before anything is replaced. */
export function readCharacterFile(text) {
    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("That file isn't a Spellbound character.");
    }

    const character = data?.format === FILE_FORMAT ? data.character : null;

    if (!character || typeof character !== "object" || !CLASSES[character.className]) {
        throw new Error("That file isn't a Spellbound character.");
    }

    return character;
}

const DAY = 24 * 60 * 60 * 1000;

const EXPORT_REMINDER_DAYS = 7;

/* "today", "yesterday", "3 days ago" or "never". */
export function exportedWhen(lastExported, now = Date.now()) {
    if (!lastExported) {
        return "never";
    }

    const days = Math.floor((now - lastExported) / DAY);

    return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/*
 * True when a backup is worth a reminder: the character changed since its last
 * export, and that export (or the character's creation) was a week ago or more.
 */
export function exportDue(character, now = Date.now()) {
    const lastExported = Number(character.lastExported) || 0;
    const since = lastExported || Number(character.createdAt) || 0;

    return (Number(character.changedAt) || 0) > lastExported && now - since >= EXPORT_REMINDER_DAYS * DAY;
}

/* Notes that a character was just saved to a file. Clears its reminder. */
export function markExported(id = roster.current) {
    if (id === roster.current) {
        state.lastExported = Date.now();
        commit();

        return;
    }

    const character = readCharacter(characterKey(id));

    if (character) {
        character.lastExported = Date.now();

        try {
            localStorage.setItem(characterKey(id), JSON.stringify(character));
        } catch (error) {
            console.error("Failed to save the character:", error);
        }

        notifyStateChange();
    }
}

/*
 * =========================================================
 * LOG (see log.js)
 * =========================================================
 */

const LOG_LIMIT = 200;

/* Writes down what happened. Keeps the newest entries; undo never takes them back. */
export function addLog(title, detail = "", dice = []) {
    state.log = [{ at: Date.now(), title, detail, dice }, ...state.log].slice(0, LOG_LIMIT);

    saveState();

    document.dispatchEvent(new Event("logchange"));
}

export function clearLog() {
    state.log = [];

    saveState();

    document.dispatchEvent(new Event("logchange"));
}

/*
 * =========================================================
 * UNDO
 * =========================================================
 *
 * commit() compares the character to how it was after the last commit, and
 * keeps the old version as an undo step when something really changed. Some
 * things aren't steps of their own, and undoing leaves them as they are:
 *   - the log and the timestamps: they're a record of what happened
 *   - moving a tile, and the action panel: otherwise undoing some damage would
 *     mean first undoing every tile moved since. Getting or removing tiles IS
 *     a step, and undoing that brings back the board and panel of that moment.
 * The steps last until the page is reloaded or the character is switched.
 */

const UNDO_LIMIT = 50;

// Changes without a name this close together (typing a name, clicking + a few times) are one step
const MERGE_WINDOW = 1000;

const undoSteps = [];

// The character as a JSON string, as it was after the last commit
let baseline = null;

const boardLetters = character => character.board.map(tile => tile.letter).sort().join("");

/* Everything that counts as a real change. */
function comparable(character) {
    const { board, action, log, createdAt, changedAt, lastExported, ...rest } = character;

    return JSON.stringify({ ...rest, letters: boardLetters(character) });
}

/* Adds an undo step if the character changed. Returns true if a step was added or extended. */
function recordChange(label, merge) {
    const before = baseline === null ? null : JSON.parse(baseline);

    if (!before || comparable(before) === comparable(state)) {
        return false;
    }

    const now = Date.now();
    const last = undoSteps.at(-1);
    const boardChanged = boardLetters(before) !== boardLetters(state);

    state.changedAt = now;

    if (last && (merge || (!label && now - last.at < MERGE_WINDOW))) {
        last.at = now;
        last.boardChanged ||= boardChanged;
    } else {
        undoSteps.push({ label: label || "last change", before: baseline, boardChanged, at: now });

        if (undoSteps.length > UNDO_LIMIT) {
            undoSteps.shift();
        }
    }

    return true;
}

/* What undo would take back, or null. */
export const undoLabel = () => undoSteps.at(-1)?.label ?? null;

/* Takes back the last step. Returns its name, or null if there's nothing to undo. */
export function undo() {
    const step = undoSteps.pop();

    if (!step) {
        return null;
    }

    const before = JSON.parse(step.before);

    if (!step.boardChanged) {
        before.board = state.board;
        before.action = state.action;
    }

    before.log = state.log;
    before.createdAt = state.createdAt;
    before.changedAt = Date.now();
    before.lastExported = state.lastExported;

    applySaved(before);
    normalizeState();

    baseline = JSON.stringify(state);

    saveState();
    addLog("Undid", step.label);
    notifyStateChange();

    return step.label;
}

/* Saves the tiles' places or the action panel, which aren't undo steps: an undo must not bring back older ones. */
export function saveWithoutUndo() {
    if (baseline !== null) {
        baseline = JSON.stringify({ ...JSON.parse(baseline), board: state.board, action: state.action });
    }

    saveState();
}

/*
 * =========================================================
 * CHANGES
 * =========================================================
 */

function notifyStateChange() {
    document.dispatchEvent(new Event("statechange"));
}

/*
 * Call after changing the state: keeps it valid, saves it, and tells every
 * panel to redraw. `label` names the undo step ("Long rest"). With `toast` a
 * message offers to undo it right away, for things that are easy to do by
 * accident; `merge` makes this part of the last step, e.g. the second half of
 * a rest.
 */
export function commit(label = null, { toast = false, merge = false } = {}) {
    normalizeState();

    const recorded = recordChange(label, merge);

    baseline = JSON.stringify(state);

    saveState();
    notifyStateChange();

    if (toast && recorded) {
        document.dispatchEvent(new CustomEvent("undoable", { detail: label }));
    }
}

export function onStateChange(render) {
    document.addEventListener("statechange", render);
}
