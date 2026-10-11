import { $, show, hide, clamp, element } from "./dom.js";
import { state, commit, onStateChange } from "./state.js";

/*
 * A simple list of what the character carries: a name and an amount.
 */

const inventoryOverlay = $("inventoryOverlay");
const inventoryList = $("inventoryList");
const addItemInput = $("addItemInput");
const addItemCount = $("addItemCount");

function newItemId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function removeItem(item) {
    state.inventory = state.inventory.filter(entry => entry !== item);
}

/* Adding something you already carry raises its amount instead. */
function addItem(name, count) {
    const existing = state.inventory.find(item => item.name.toLowerCase() === name.toLowerCase());

    if (existing) {
        existing.count += count;
    } else {
        state.inventory.push({ id: newItemId(), name, count });
    }

    commit();
}

$("addItemForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = addItemInput.value.trim();

    if (!name) {
        return;
    }

    addItem(name.slice(0, 60), clamp(parseInt(addItemCount.value, 10) || 1, 1, 999));

    addItemInput.value = "";
    addItemCount.value = 1;
    addItemInput.focus();
});

function changeCount(item, change) {
    item.count += change;

    if (item.count <= 0) {
        removeItem(item);
    }

    commit();
}

function renderItemCard(item) {
    const card = element("div", "item-card");

    const minus = element("button", "count-button", "−");
    const plus = element("button", "count-button", "+");
    const discard = element("button", "item-discard", "×");

    minus.title = item.count > 1 ? "Use one" : "Use the last one";
    plus.title = "Add one";
    discard.title = `Throw away ${item.name}`;

    minus.setAttribute("aria-label", minus.title);
    plus.setAttribute("aria-label", plus.title);
    discard.setAttribute("aria-label", discard.title);

    minus.addEventListener("click", () => changeCount(item, -1));
    plus.addEventListener("click", () => changeCount(item, 1));
    discard.addEventListener("click", () => {
        removeItem(item);
        commit();
    });

    const count = element("span", "counter", "");

    count.append(minus, element("strong", null, item.count), plus);

    card.append(element("div", "item-name", item.name), count, discard);

    return card;
}

export function renderInventory() {
    inventoryList.replaceChildren(...state.inventory.map(renderItemCard));

    $("inventoryEmpty").classList.toggle("hidden", state.inventory.length > 0);
}

$("inventoryButton").addEventListener("click", () => {
    renderInventory();

    addItemInput.value = "";
    addItemCount.value = 1;

    show(inventoryOverlay);
    addItemInput.focus();
});

$("closeInventory").addEventListener("click", () => hide(inventoryOverlay));

onStateChange(renderInventory);
