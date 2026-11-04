import { $, show, hide, setValue, element } from "./dom.js";
import {
    state,
    commit,
    addLog,
    onStateChange,
    hasFeat,
    subclassIs,
    hasConstruct,
    colossusActive,
    canColossus,
    endColossus,
    constructHealth,
    constructMaxHealth,
    constructArmor,
    constructRank,
    constructDie,
    constructHasToolkit,
    hasHelpers,
    maxHelpers,
    constructParts,
    partMaxHealth,
    partHealth,
    constructDown,
    partsStanding,
    newHelper,
    maxModules,
    availableModules,
    hasModule
} from "./state.js";
import { poolNotation, MODULES } from "./rules.js";
import { preference, setPreference } from "./preferences.js";
import { openRollSetup } from "./casting.js";
import { armorReduces } from "./character.js";

/*
 * A Golemwright's construct: its own hit points and armor, a weapon attack
 * with its own pool, its modules (a Toolkit lets it take mundane Change and
 * Create actions instead), and for a Warforger, Colossus. A Clockmaker has
 * several small constructs instead (Little Helpers), each with its own share
 * of the hit points, added and removed here. At 0 HP a construct is destroyed
 * until the next long rest, or short rest with Field Repairs (see the rests
 * in character.js). Its part of the menu folds shut so it's out of the way
 * when it isn't needed.
 */

const constructOverlay = $("constructOverlay");
const amountInput = $("constructAmountInput");
const nameInput = $("constructNameInput");

const constructName = () => state.construct.name.trim() || "Construct";

// The construct the window damages and heals: an index into constructParts()
let selected = 0;

const selectedPart = () => constructParts()[Math.min(selected, constructParts().length - 1)];

/* "Cog", or "Cog 2" for one of a Clockmaker's small constructs. */
const partName = index => hasHelpers() ? `${constructName()} ${index + 1}` : constructName();

const partHPText = part => part.destroyed ? "Destroyed" : `${partHealth(part)} / ${partMaxHealth()}`;

/* One button per small construct, which opens the window for that one. */
function renderHelpers() {
    const helpers = state.construct.helpers;

    $("helperCount").textContent = `${helpers.length} / ${maxHelpers()}`;
    $("helperMinus").disabled = helpers.length <= 1;
    $("helperPlus").disabled = helpers.length >= maxHelpers();
    $("helperCounter").title = `Small constructs, up to your Create rank (${maxHelpers()}). ` +
        `They share ${constructMaxHealth()} hit points: ${partMaxHealth()} each.`;

    $("helperList").replaceChildren(...helpers.map((helper, index) => {
        const button = element("button", "roll-button");

        button.type = "button";
        button.title = `Damage or heal ${partName(index)}`;
        button.classList.toggle("destroyed", helper.destroyed);
        button.append(element("span", null, partName(index)), element("span", null, partHPText(helper)));
        button.addEventListener("click", () => openConstruct(index));

        return button;
    }));
}

function renderConstructPanel() {
    const panel = $("constructPanel");

    panel.classList.toggle("hidden", !hasConstruct());

    if (!hasConstruct()) {
        return;
    }

    const destroyed = constructDown();
    const helpers = hasHelpers();
    const open = preference("constructOpen");

    panel.classList.toggle("folded", !open);
    panel.classList.toggle("destroyed", destroyed);
    $("constructExpand").title = helpers
        ? `Show ${constructName()} (${partsStanding()} of ${constructParts().length} standing)`
        : `Show ${constructName()} (${destroyed ? "destroyed" : `${constructHealth()} / ${constructMaxHealth()} HP`})`;

    $("constructNameDisplay").textContent = constructName();
    $("constructHPDisplay").textContent = partHPText(state.construct);

    // Little Helpers: a row per small construct instead of one hit point button
    $("constructHPButton").classList.toggle("hidden", helpers);
    $("helperCounter").classList.toggle("hidden", !helpers);
    $("helperList").classList.toggle("hidden", !helpers);

    if (helpers) {
        renderHelpers();
    }

    alignWithStats();

    $("constructAttackDisplay").textContent = `${poolNotation(constructRank())} · d${constructDie()}`;
    $("constructAttackButton").classList.toggle("roll-disabled", destroyed);

    // Toolkit: a mundane Change or Create action instead of attacking, with the attack's rank
    $("constructActionButton").classList.toggle("hidden", !constructHasToolkit());
    $("constructActionButton").classList.toggle("roll-disabled", destroyed);
    $("constructActionDisplay").textContent = poolNotation(constructRank());

    const colossus = $("colossusButton");
    const rounds = state.construct.colossusRounds;

    colossus.classList.toggle("hidden", !canColossus());
    colossus.classList.toggle("active", colossusActive());
    colossus.classList.toggle("roll-disabled", destroyed || (!colossusActive() && state.construct.colossusUsed));
    $("colossusDisplay").textContent = colossusActive() ? "Active" : state.construct.colossusUsed ? "0 / 1" : "1 / 1";
    colossus.title = (colossusActive() ? "Click to end it early.\n\n" : "Once per long rest. ") +
        "Your construct grows huge for 3 rounds: twice the hit points, weapon die one size bigger. Each attack hits one target with its weapon die twice per level, or stomps every enemy within 10 feet.";

    $("colossusRoundButton").classList.toggle("hidden", !colossusActive());
    $("colossusRoundsDisplay").textContent = `${rounds} left`;
    $("colossusRoundButton").title = `Counts down Colossus: ${rounds} ${rounds === 1 ? "round" : "rounds"} left`;
}

function renderConstructModal() {
    const part = selectedPart();

    $("constructTitle").textContent = partName(constructParts().indexOf(part));
    $("constructModalCurrent").textContent = partHealth(part);
    $("constructModalMax").textContent = partMaxHealth();
    $("constructArmorHint").textContent = constructArmor();

    setValue(nameInput, state.construct.name);

    const rebuild = `You can build a new one during your next ${state.level >= 3 ? "short or long rest (Field Repairs: with half its hit points)" : "long rest"}.`;

    $("constructInfo").textContent = part.destroyed
        ? `Destroyed. ${rebuild}`
        : hasHelpers()
            ? `One of ${constructParts().length} small constructs, each no bigger than a cat. They share ${constructMaxHealth()} hit points ` +
              `(${partMaxHealth()} each), armor ${constructArmor()} and their modules. On your casting turn, one makes the attack, ` +
              `and each of the others can do a simple task that needs no roll.`
            : `Made of scrap, no bigger than ${hasWarforgerFrame() ? "a horse" : "a person"}. Armor ${constructArmor()}. ` +
              `Its attack is rolled during your pre-turn, right after yours, and it acts right after you on your casting turn. ` +
              `It follows your spoken commands (no action), and otherwise stays next to you and defends you.`;

    renderModules();
}

/* Opens the window for the construct at `index` (always 0 without Little Helpers). */
function openConstruct(index) {
    selected = index;
    amountInput.value = 1;
    $("constructMessage").textContent = "";

    renderConstructModal();
    show(constructOverlay);
}

/* Heavy Frame (Warforger): as big as a horse. */
const hasWarforgerFrame = () => subclassIs("warforger");

/*
 * One checkbox per module it can have. Once it has as many as its frame
 * allows, the others are greyed out until one is taken off.
 */
function renderModules() {
    const chosen = state.construct.modules.length;
    const max = maxModules();

    $("moduleSummary").textContent = `${chosen} / ${max}`;
    $("moduleSummary").classList.toggle("attention", chosen < max);

    const rows = availableModules().map(key => {
        const module = MODULES[key];
        const taken = hasModule(key);
        const row = element("label", "feat-row");
        const checkbox = element("input");
        const text = element("span", "feat-text");

        checkbox.type = "checkbox";
        checkbox.checked = taken;
        checkbox.disabled = !taken && chosen >= max;

        checkbox.addEventListener("change", () => {
            state.construct.modules = checkbox.checked
                ? [...state.construct.modules, key]
                : state.construct.modules.filter(other => other !== key);
            commit();
        });

        row.classList.toggle("taken", taken);
        row.classList.toggle("locked", checkbox.disabled);

        text.append(element("strong", null, module.name), element("span", "result-label", module.text));
        row.append(checkbox, text);

        return row;
    });

    if (!hasFeat("spareParts")) {
        rows.push(element("p", "settings-note", "Spare Parts (feat, level 4+) adds Compartment, Grapple Arm and Smoke Vents."));
    }

    $("moduleList").replaceChildren(...rows);
}

function render() {
    renderConstructPanel();

    if (!constructOverlay.classList.contains("hidden")) {
        renderConstructModal();
    }
}

/*
 * The construct's column sits to the right of the menu, starting level with
 * the HP and Armor boxes. The menu can scroll on short screens, so this
 * follows it.
 */
function alignWithStats() {
    const menu = $("rollMenu");

    $("constructPanel").style.top = `${menu.offsetTop + $("statGrid").offsetTop - menu.scrollTop}px`;
}

$("rollMenu").addEventListener("scroll", alignWithStats);
window.addEventListener("resize", alignWithStats);

function setOpen(open) {
    setPreference("constructOpen", open);
    renderConstructPanel();

    // Keyboard users stay on the button that does the opposite
    $(open ? "constructCollapse" : "constructExpand").focus();
}

$("constructExpand").addEventListener("click", () => setOpen(true));
$("constructCollapse").addEventListener("click", () => setOpen(false));

/*
 * =========================================================
 * HIT POINTS
 * =========================================================
 */

function amount() {
    return parseInt(amountInput.value, 10);
}

$("constructHPButton").addEventListener("click", () => openConstruct(0));

$("closeConstruct").addEventListener("click", () => hide(constructOverlay));

$("constructDamageButton").addEventListener("click", () => {
    const damage = amount();
    const part = selectedPart();

    if (Number.isNaN(damage) || damage < 0 || part.destroyed) {
        return;
    }

    const taken = $("constructArmorInput").checked ? armorReduces(constructArmor())(damage) : damage;

    part.damage += taken;

    if (part.damage >= partMaxHealth()) {
        part.destroyed = true;
        part.damage = 0;
        state.construct.colossusRounds = 0;
    }

    const name = partName(constructParts().indexOf(part));

    commit(`${name} took ${taken} damage`, { toast: true });
    addLog(`${name}: damage`, part.destroyed ? `Took ${taken} damage. Destroyed.` : `Took ${taken} damage. HP ${partHealth(part)} / ${partMaxHealth()}`);

    $("constructMessage").textContent = part.destroyed
        ? `Took ${taken} damage. ${name} is destroyed.`
        : taken === damage ? `Took ${taken} damage.` : `Took ${taken} damage (${damage} before armor).`;
});

/* Aid spells and first aid heal it like a creature. */
$("constructHealButton").addEventListener("click", () => {
    const healing = amount();
    const part = selectedPart();

    if (Number.isNaN(healing) || healing <= 0 || part.destroyed) {
        return;
    }

    part.damage = Math.max(0, part.damage - healing);
    commit(`Healed ${constructName()}`, { toast: true });
    addLog(`${partName(constructParts().indexOf(part))}: healing`, `Healed ${healing}. HP ${partHealth(part)} / ${partMaxHealth()}`);

    $("constructMessage").textContent = `Healed ${healing}.`;
});

/*
 * Little Helpers: more small constructs split the hit points into smaller
 * shares. A new one starts at full hit points; taking one away removes a
 * destroyed one first, then the last.
 */
$("helperPlus").addEventListener("click", () => {
    if (state.construct.helpers.length < maxHelpers()) {
        state.construct.helpers.push(newHelper());
        commit();
    }
});

$("helperMinus").addEventListener("click", () => {
    const helpers = state.construct.helpers;

    if (helpers.length <= 1) {
        return;
    }

    const destroyed = helpers.findLastIndex(helper => helper.destroyed);

    helpers.splice(destroyed >= 0 ? destroyed : helpers.length - 1, 1);
    commit();
});

nameInput.addEventListener("input", () => {
    state.construct.name = nameInput.value.slice(0, 30);
    commit();
});

/*
 * =========================================================
 * ACTIONS
 * =========================================================
 */

$("constructAttackButton").addEventListener("click", () => {
    if (!constructDown()) {
        openRollSetup("harm", "constructWeapon");
    }
});

$("constructActionButton").addEventListener("click", () => {
    if (!constructDown()) {
        openRollSetup("change", "constructAction");
    }
});

/* Colossus doubles its hit points for 3 rounds; damage it took stays taken. */
$("colossusButton").addEventListener("click", () => {
    if (state.construct.destroyed) {
        return;
    }

    if (colossusActive()) {
        endColossus();
    } else if (!state.construct.colossusUsed) {
        state.construct.colossusUsed = true;
        state.construct.colossusRounds = 3;
    }

    commit("Colossus");
});

$("colossusRoundButton").addEventListener("click", () => {
    if (state.construct.colossusRounds <= 1) {
        endColossus();
    } else {
        state.construct.colossusRounds--;
    }

    commit("Next round");
});

onStateChange(render);
