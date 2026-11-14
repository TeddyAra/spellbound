import { $, element, hide, show } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    newWeapon,
    equipWeapon,
    canEquipWeapon,
    allowedWeaponDice,
    weaponBonusPrefix
} from "./state.js";
import { STANDARD_WEAPONS, WEAPON_TYPES } from "./rules.js";

/*
 * The Weapons part of the inventory window: the weapons the character owns,
 * from the standard list or made by the player. Equipped ones get a button in
 * the menu (see casting.js). The rules for hands are in state.js.
 */

const standardInput = $("standardWeaponInput");
const form = $("customWeaponForm");
const nameInput = $("customWeaponName");
const dieInput = $("customWeaponDie");
const descriptionInput = $("customWeaponDescription");
const rangedInput = $("customWeaponRanged");
const twoHandedInput = $("customWeaponTwoHanded");
const bonusInput = $("customWeaponBonus");

// The weapon being changed in the form, or null for a new one
let editing = null;

/*
 * =========================================================
 * THE LISTS OF TYPES
 * =========================================================
 */

const typeLabel = die => `${WEAPON_TYPES[die]} (d${die})`;

for (const die of Object.keys(WEAPON_TYPES)) {
    const group = element("optgroup");

    group.label = typeLabel(die);

    STANDARD_WEAPONS.forEach((weapon, index) => {
        if (weapon.die === Number(die)) {
            const details = [weapon.twoHanded && "two-handed", weapon.ranged && "ranged"].filter(Boolean).join(", ");
            const option = element("option", null, details ? `${weapon.name} (${details})` : weapon.name);

            option.value = index;
            group.append(option);
        }
    });

    standardInput.append(group);

    const type = element("option", null, typeLabel(die));

    type.value = die;
    dieInput.append(type);
}

/*
 * =========================================================
 * ADDING AND CHANGING
 * =========================================================
 */

$("addWeaponForm").addEventListener("submit", event => {
    event.preventDefault();

    const weapon = newWeapon(STANDARD_WEAPONS[standardInput.value]);

    state.weapons.push(weapon);
    commit(`Added ${weapon.name}`);
});

function closeForm() {
    editing = null;
    hide(form);
}

/* Empty for a new weapon, filled in to change one. */
function openForm(weapon = null) {
    editing = weapon?.id ?? null;

    $("customWeaponTitle").textContent = weapon ? `Change ${weapon.name}` : "New weapon";
    $("saveCustomWeapon").textContent = weapon ? "Save" : "Add weapon";

    nameInput.value = weapon?.name ?? "";
    dieInput.value = weapon?.die ?? allowedWeaponDice().at(-1);
    bonusInput.value = weapon?.bonus ?? 0;
    descriptionInput.value = weapon?.description ?? "";
    rangedInput.checked = weapon?.ranged ?? false;
    twoHandedInput.checked = weapon?.twoHanded ?? false;

    show(form);
    form.scrollIntoView({ block: "nearest" });
    nameInput.focus();
}

$("customWeaponButton").addEventListener("click", () => openForm());
$("cancelCustomWeapon").addEventListener("click", closeForm);

/* What was put away to make room, for the message: "Equipped Maul and put away Dagger and shield". */
function commitEquip(weapon, verb, putAway) {
    if (putAway.length) {
        commit(`${verb} ${weapon.name} and put away ${putAway.join(" and ")}`, { toast: true });
    } else {
        commit(`${verb} ${weapon.name}`);
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();

    const changes = {
        name: nameInput.value,
        description: descriptionInput.value,
        die: dieInput.value,
        bonus: bonusInput.value,
        ranged: rangedInput.checked,
        twoHanded: twoHandedInput.checked
    };

    const existing = state.weapons.find(weapon => weapon.id === editing);

    closeForm();

    if (!existing) {
        const weapon = newWeapon(changes);

        state.weapons.push(weapon);
        commit(`Added ${weapon.name}`);

        return;
    }

    const wasEquipped = existing.equipped;

    Object.assign(existing, newWeapon({ ...changes, id: existing.id }));

    // It may need more hands now, or be a type the class can't use
    commitEquip(existing, "Changed", wasEquipped && canEquipWeapon(existing) ? equipWeapon(existing) : []);
});

function toggleEquipped(weapon) {
    if (weapon.equipped) {
        weapon.equipped = false;
        commit(`Put away ${weapon.name}`);
    } else {
        commitEquip(weapon, "Equipped", equipWeapon(weapon));
    }
}

/*
 * =========================================================
 * THE LIST
 * =========================================================
 */

function weaponDetails(weapon) {
    return [
        weapon.bonus ? `Magic +${weapon.bonus}` : null,
        `${WEAPON_TYPES[weapon.die]} d${weapon.die}`,
        weapon.twoHanded && "Two-handed",
        weapon.ranged && "Ranged"
    ].filter(Boolean).join(" · ");
}

function renderWeaponCard(weapon) {
    const card = element("div", "item-card");
    const details = element("div", "item-details");
    const equip = element("button", weapon.equipped ? "weapon-equip primary" : "weapon-equip", weapon.equipped ? "Equipped" : "Equip");
    const edit = element("button", "item-edit", "Edit");
    const discard = element("button", "item-discard", "×");

    card.classList.toggle("active", weapon.equipped);

    details.append(element("span", "item-name", weaponBonusPrefix(weapon) + weapon.name), element("span", "result-label", weaponDetails(weapon)));

    if (weapon.description) {
        details.append(element("span", "result-label", weapon.description));
    }

    equip.type = edit.type = discard.type = "button";
    equip.setAttribute("aria-pressed", String(weapon.equipped));
    equip.addEventListener("click", () => toggleEquipped(weapon));

    if (!canEquipWeapon(weapon)) {
        equip.disabled = true;
        equip.title = `Your class can't use ${WEAPON_TYPES[weapon.die].toLowerCase()} weapons`;
    } else {
        equip.title = weapon.equipped ? "Put it away" : "Equip it, so you can attack with it";
    }

    edit.setAttribute("aria-label", `Change ${weapon.name}`);
    edit.addEventListener("click", () => openForm(weapon));

    discard.title = `Throw away ${weapon.name}`;
    discard.setAttribute("aria-label", discard.title);
    discard.addEventListener("click", () => {
        if (editing === weapon.id) {
            closeForm();
        }

        state.weapons = state.weapons.filter(entry => entry !== weapon);
        commit(`Threw away ${weapon.name}`, { toast: true });
    });

    card.append(details, equip, edit, discard);

    return card;
}

onStateChange(() => {
    $("weaponList").replaceChildren(...state.weapons.map(renderWeaponCard));
    $("weaponsEmpty").classList.toggle("hidden", state.weapons.length > 0);
});
