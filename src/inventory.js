import { $, show, hide, element, sum } from "./dom.js";
import { state, commit, onStateChange, newItem, addToInventory } from "./state.js";
import { STANDARD_ITEMS } from "./rules.js";
import { rollDice } from "./dice.js";
import { showInfoResult } from "./results.js";
import { updateCurrentHealth } from "./character.js";

/*
 * What the character carries: items from the standard list or made by the
 * player, with an amount. Items that roll dice have a Use button. The weapons
 * are in the same window (see weapons.js).
 */

const inventoryOverlay = $("inventoryOverlay");
const inventoryList = $("inventoryList");
const standardInput = $("standardItemInput");
const addItemCount = $("addItemCount");
const form = $("customItemForm");
const nameInput = $("customItemName");
const countInput = $("customItemCount");
const descriptionInput = $("customItemDescription");
const effectInput = $("customItemEffect");
const diceInput = $("customItemDice");
const sidesInput = $("customItemSides");

// The item being changed in the form, or null for a new one
let editing = null;

const effectDice = ({ dice, sides }) => `${dice}d${sides}`;

/*
 * =========================================================
 * ADDING
 * =========================================================
 */

for (const groupName of new Set(STANDARD_ITEMS.map(item => item.group))) {
    const group = element("optgroup");

    group.label = groupName;

    STANDARD_ITEMS.forEach((item, index) => {
        if (item.group === groupName) {
            const option = element("option", null, item.name);

            option.value = index;
            group.append(option);
        }
    });

    standardInput.append(group);
}

/* Ammunition comes in bigger amounts than a potion. */
function fillDefaultAmount() {
    addItemCount.value = STANDARD_ITEMS[standardInput.value].amount ?? 1;
}

standardInput.addEventListener("change", fillDefaultAmount);
fillDefaultAmount();

$("addItemForm").addEventListener("submit", event => {
    event.preventDefault();

    const item = addToInventory({ ...STANDARD_ITEMS[standardInput.value], count: addItemCount.value });

    commit(`Added ${item.name}`);
});

/*
 * =========================================================
 * MAKING YOUR OWN
 * =========================================================
 */

function closeForm() {
    editing = null;
    hide(form);
}

function renderDiceRow() {
    const rolls = Boolean(effectInput.value);

    $("customItemDiceLabel").classList.toggle("hidden", !rolls);
    $("customItemDiceRow").classList.toggle("hidden", !rolls);
}

effectInput.addEventListener("change", renderDiceRow);

/* Empty for a new item, filled in to change one. */
function openForm(item = null) {
    editing = item?.id ?? null;

    $("customItemTitle").textContent = item ? `Change ${item.name}` : "New item";
    $("saveCustomItem").textContent = item ? "Save" : "Add item";

    nameInput.value = item?.name ?? "";
    countInput.value = item?.count ?? 1;
    descriptionInput.value = item?.description ?? "";
    effectInput.value = item?.effect?.kind ?? "";
    diceInput.value = item?.effect?.dice ?? 1;
    sidesInput.value = item?.effect?.sides ?? 6;

    renderDiceRow();
    show(form);
    form.scrollIntoView({ block: "nearest" });
    nameInput.focus();
}

$("customItemButton").addEventListener("click", () => openForm());
$("cancelCustomItem").addEventListener("click", closeForm);

form.addEventListener("submit", event => {
    event.preventDefault();

    const fields = {
        name: nameInput.value,
        description: descriptionInput.value,
        count: countInput.value,
        effect: { kind: effectInput.value, dice: diceInput.value, sides: sidesInput.value }
    };

    const existing = state.inventory.find(item => item.id === editing);

    closeForm();

    if (existing) {
        Object.assign(existing, newItem({ ...fields, id: existing.id }));
        commit(`Changed ${existing.name}`);
    } else {
        commit(`Added ${addToInventory(fields).name}`);
    }
});

/*
 * =========================================================
 * USING AND THROWING AWAY
 * =========================================================
 */

function removeItem(item) {
    if (editing === item.id) {
        closeForm();
    }

    state.inventory = state.inventory.filter(entry => entry !== item);
}

function changeCount(item, change, label) {
    item.count += change;

    if (item.count <= 0) {
        removeItem(item);
    }

    commit(label);
}

/*
 * Rolls its dice and uses one up. Healing is only added once the player says
 * it's for them: a potion can also be given to someone else.
 */
async function useItem(item) {
    const { id, name, effect } = item;
    const rolls = await rollDice(effectDice(effect));

    if (!rolls) {
        return;
    }

    // Found again: the state may have been replaced during the roll
    const current = state.inventory.find(entry => entry.id === id);

    if (current) {
        changeCount(current, -1, `Used ${name}`);
    }

    const total = sum(rolls);
    const healing = effect.kind === "heal";

    showInfoResult(name, [
        [`${healing ? "Healing" : "Damage"} (${effectDice(effect)})`, total]
    ], { title: "Effect dice", values: rolls }, {
        action: healing
            ? { label: `Heal me for ${total}`, onClick: () => updateCurrentHealth(total, { label: `${name}: healed ${total}` }) }
            : null
    });
}

function renderItemCard(item) {
    const card = element("div", "item-card inventory-item");
    const details = element("div", "item-details");

    const minus = element("button", "count-button", "−");
    const plus = element("button", "count-button", "+");
    const edit = element("button", "item-edit", "Edit");
    const discard = element("button", "item-discard", "×");

    details.append(element("span", "item-name", item.name));

    if (item.description) {
        details.append(element("span", "result-label", item.description));
    }

    minus.type = plus.type = edit.type = discard.type = "button";

    minus.title = item.count > 1 ? "Use one" : "Use the last one";
    plus.title = "Add one";
    discard.title = `Throw away ${item.name}`;

    minus.setAttribute("aria-label", minus.title);
    plus.setAttribute("aria-label", plus.title);
    edit.setAttribute("aria-label", `Change ${item.name}`);
    discard.setAttribute("aria-label", discard.title);

    minus.addEventListener("click", () => changeCount(item, -1, `Changed ${item.name}`));
    plus.addEventListener("click", () => changeCount(item, 1, `Changed ${item.name}`));
    edit.addEventListener("click", () => openForm(item));
    discard.addEventListener("click", () => {
        removeItem(item);
        commit(`Threw away ${item.name}`, { toast: true });
    });

    const count = element("span", "counter", "");

    count.append(minus, element("strong", null, item.count), plus);

    card.append(details);

    if (item.effect) {
        const use = element("button", "item-use primary", `Use ${effectDice(item.effect)}`);

        use.type = "button";
        use.title = `Use one: rolls ${effectDice(item.effect)}`;
        use.addEventListener("click", () => useItem(item));

        card.append(use);
    }

    card.append(count, edit, discard);

    return card;
}

export function renderInventory() {
    inventoryList.replaceChildren(...state.inventory.map(renderItemCard));

    $("inventoryEmpty").classList.toggle("hidden", state.inventory.length > 0);
}

$("inventoryButton").addEventListener("click", () => {
    renderInventory();
    show(inventoryOverlay);
});

$("closeInventory").addEventListener("click", () => hide(inventoryOverlay));

onStateChange(renderInventory);
