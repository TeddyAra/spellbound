import { $, show, hide, setValue } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    subclassIs,
    hasConstruct,
    colossusActive,
    endColossus,
    constructHealth,
    constructMaxHealth,
    constructArmor,
    constructRank,
    constructDie
} from "./state.js";
import { poolNotation } from "./rules.js";
import { preference, setPreference } from "./preferences.js";
import { openRollSetup } from "./casting.js";
import { armorReduces } from "./character.js";

/*
 * A Runesmith's construct (level 3, or 2 for a Golemwright): its own hit
 * points and armor, a weapon attack with its own pool, and for a Golemwright
 * mundane actions and Colossus. At 0 HP it's destroyed until the next long
 * rest (see the long rest in character.js). Its part of the menu folds shut
 * so it's out of the way when it isn't needed.
 */

const constructOverlay = $("constructOverlay");
const amountInput = $("constructAmountInput");
const nameInput = $("constructNameInput");

const constructName = () => state.construct.name.trim() || "Construct";

const canColossus = () => subclassIs("golemwright") && state.level >= 10;

function renderConstructPanel() {
    const panel = $("constructPanel");

    panel.classList.toggle("hidden", !hasConstruct());

    if (!hasConstruct()) {
        return;
    }

    const { destroyed } = state.construct;
    const open = preference("constructOpen");

    panel.classList.toggle("folded", !open);
    panel.classList.toggle("destroyed", destroyed);
    $("constructExpand").title = `Show ${constructName()} (${destroyed ? "destroyed" : `${constructHealth()} / ${constructMaxHealth()} HP`})`;

    $("constructNameDisplay").textContent = constructName();
    $("constructHPDisplay").textContent = destroyed ? "Destroyed" : `${constructHealth()} / ${constructMaxHealth()}`;

    alignWithStats();

    $("constructAttackDisplay").textContent = `${poolNotation(constructRank())} · d${constructDie()}`;
    $("constructAttackButton").classList.toggle("roll-disabled", destroyed);

    const golemwright = subclassIs("golemwright");

    $("constructActionButton").classList.toggle("hidden", !golemwright);
    $("constructActionButton").classList.toggle("roll-disabled", destroyed);

    const colossus = $("colossusButton");
    const rounds = state.construct.colossusRounds;

    colossus.classList.toggle("hidden", !canColossus());
    colossus.classList.toggle("active", colossusActive());
    colossus.classList.toggle("roll-disabled", destroyed || (!colossusActive() && state.construct.colossusUsed));
    $("colossusDisplay").textContent = colossusActive() ? "Active" : state.construct.colossusUsed ? "0 / 1" : "1 / 1";
    colossus.title = (colossusActive() ? "Click to end it early.\n\n" : "Once per long rest. ") +
        "Your construct grows huge for 3 rounds: twice the hit points, weapon die one size bigger, and its attacks also hit one target next to it.";

    $("colossusRoundButton").classList.toggle("hidden", !colossusActive());
    $("colossusRoundsDisplay").textContent = `${rounds} left`;
    $("colossusRoundButton").title = `Counts down Colossus: ${rounds} ${rounds === 1 ? "round" : "rounds"} left`;
}

function renderConstructModal() {
    $("constructTitle").textContent = constructName();
    $("constructModalCurrent").textContent = constructHealth();
    $("constructModalMax").textContent = constructMaxHealth();
    $("constructArmorHint").textContent = constructArmor();

    setValue(nameInput, state.construct.name);

    $("constructInfo").textContent = state.construct.destroyed
        ? "Destroyed. You can build a new one during your next long rest."
        : `Made of scrap, no bigger than a person. Armor ${constructArmor()}. Acts right after you on your casting turn, ` +
          `follows your spoken commands (no action), and otherwise stays next to you and defends you.`;
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

$("constructHPButton").addEventListener("click", () => {
    amountInput.value = 1;
    $("constructMessage").textContent = "";

    renderConstructModal();
    show(constructOverlay);
});

$("closeConstruct").addEventListener("click", () => hide(constructOverlay));

$("constructDamageButton").addEventListener("click", () => {
    const damage = amount();

    if (Number.isNaN(damage) || damage < 0 || state.construct.destroyed) {
        return;
    }

    const taken = $("constructArmorInput").checked ? armorReduces(constructArmor())(damage) : damage;

    state.construct.damage += taken;

    if (state.construct.damage >= constructMaxHealth()) {
        state.construct.destroyed = true;
        state.construct.colossusRounds = 0;
    }

    commit();

    $("constructMessage").textContent = state.construct.destroyed
        ? `Took ${taken} damage. ${constructName()} is destroyed.`
        : taken === damage ? `Took ${taken} damage.` : `Took ${taken} damage (${damage} before armor).`;
});

/* Aid spells and first aid heal it like a creature. */
$("constructHealButton").addEventListener("click", () => {
    const healing = amount();

    if (Number.isNaN(healing) || healing <= 0 || state.construct.destroyed) {
        return;
    }

    state.construct.damage = Math.max(0, state.construct.damage - healing);
    commit();

    $("constructMessage").textContent = `Healed ${healing}.`;
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
    if (!state.construct.destroyed) {
        openRollSetup("harm", "constructWeapon");
    }
});

$("constructActionButton").addEventListener("click", () => {
    if (!state.construct.destroyed) {
        openRollSetup("harm", "constructAction");
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

    commit();
});

$("colossusRoundButton").addEventListener("click", () => {
    if (state.construct.colossusRounds <= 1) {
        endColossus();
    } else {
        state.construct.colossusRounds--;
    }

    commit();
});

onStateChange(render);
