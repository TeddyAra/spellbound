import { $, show, hide, clamp, element } from "./dom.js";
import {
    state,
    commit,
    onStateChange,
    characterClass,
    featCount,
    maxSignatureUses,
    maxRunes,
    schoolName
} from "./state.js";
import { RANKED_SCHOOLS, SUBCLASS_LEVEL, TONGUES, featsAllowed, featsFor } from "./rules.js";
import { takenFeats, unusedFeats } from "./reminders.js";

/*
 * The features and feats window: what the class can do (features above the
 * character's level are shown dimmed, to plan ahead), and the feats taken.
 */

const featuresOverlay = $("featuresOverlay");

function featureCard(name, text, level, extra = null) {
    const card = element("div", "feature-card");
    const header = element("div", "feature-header");

    header.append(element("strong", null, name));

    if (level !== null) {
        header.append(element("span", "feature-level", `Level ${level}`));
    }

    if (extra) {
        header.append(element("span", "feature-level", extra));
    }

    card.append(header, element("p", null, text));
    card.classList.toggle("locked", level !== null && level > state.level);

    return card;
}

function renderFeatures() {
    const info = characterClass();
    const subclass = info.subclasses[state.subclass];

    $("featuresTitle").textContent = `${info.name} Features`;

    const cards = [
        featureCard(
            info.signature.name,
            info.signature.text,
            null,
            info.signature.glyphs ? `${maxSignatureUses()} at once` : `${maxSignatureUses()} per long rest`
        )
    ];

    if (info.signature.glyphs) {
        cards.push(featureCard("Runes", "Spells stored in objects with Inscribe. Anyone holding one releases it as a bonus action, after which it fades.", null, `${maxRunes()} at once`));
    }

    for (const feature of info.features) {
        cards.push(featureCard(feature.name, feature.text, feature.level));
    }

    if (subclass) {
        cards.push(element("div", "rolls-title feature-group", subclass.name));

        for (const feature of subclass.features) {
            cards.push(featureCard(feature.name, feature.text, Math.max(feature.level, SUBCLASS_LEVEL)));
        }
    } else {
        cards.push(element("p", "settings-note", "Choose a subclass in Character settings at level 2 to see its features."));
    }

    // Every Tongue you know gives a small perk
    cards.push(element("div", "rolls-title feature-group", "Tongues"));

    const known = state.tongues.filter(key => TONGUES[key]);

    for (const key of known) {
        const tongue = TONGUES[key];

        cards.push(featureCard(tongue.perk, tongue.text, null, key === state.tongues[0] ? `${tongue.name} · native` : tongue.name));
    }

    if (known.length < state.tongues.length) {
        cards.push(element("p", "settings-note", "Choose your Tongues in Character settings to see their perks."));
    }

    $("featureList").replaceChildren(...cards);
}

/*
 * =========================================================
 * FEATS
 * =========================================================
 */

function setFeat(key, count) {
    if (count > 0) {
        state.feats[key] = count;
    } else {
        delete state.feats[key];
    }

    commit();
}

/* A school for every time Trained was taken. */
function trainedSchoolPicker() {
    const picker = element("span", "trained-schools");

    state.trainedSchools.forEach((choice, index) => {
        const select = element("select", "modal-input");

        select.setAttribute("aria-label", `Trained school ${index + 1}`);
        select.classList.toggle("needs-attention", !choice);

        const options = [["", "Choose a school"], ...RANKED_SCHOOLS.map(school => [school, schoolName(school)])];

        select.replaceChildren(...options.map(([value, text]) => {
            const option = element("option", null, text);

            option.value = value;

            return option;
        }));

        select.value = choice;

        select.addEventListener("change", () => {
            state.trainedSchools[index] = select.value;
            commit();
        });

        picker.append(select);
    });

    return picker;
}

function featRow(feat) {
    const count = featCount(feat.key);
    const tooLow = (feat.minLevel ?? 1) > state.level;

    // A label would pass clicks on the text to the counter's first button
    const row = element(feat.repeatable ? "div" : "label", "feat-row");

    row.classList.toggle("taken", count > 0);
    row.classList.toggle("locked", tooLow && count === 0);

    const text = element("span", "feat-text");
    const name = element("strong", null, feat.name);

    if (feat.minLevel) {
        name.append(element("span", "feature-level", ` ${feat.minLevel}+`));
    }

    text.append(name, element("span", "result-label", feat.text));

    if (feat.key === "trained" && count > 0) {
        text.append(trainedSchoolPicker());
    }

    if (feat.repeatable) {
        const counter = element("span", "counter");
        const minus = element("button", null, "−");
        const plus = element("button", null, "+");

        minus.type = "button";
        plus.type = "button";
        minus.setAttribute("aria-label", `Take ${feat.name} once fewer`);
        plus.setAttribute("aria-label", `Take ${feat.name} once more`);
        plus.disabled = tooLow || count >= feat.repeatable;

        minus.addEventListener("click", () => setFeat(feat.key, clamp(count - 1, 0, feat.repeatable)));
        plus.addEventListener("click", () => setFeat(feat.key, clamp(count + 1, 0, feat.repeatable)));

        counter.append(minus, element("strong", null, count), plus);
        row.append(text, counter);
    } else {
        const checkbox = element("input");

        checkbox.type = "checkbox";
        checkbox.checked = count > 0;
        checkbox.disabled = tooLow && count === 0;
        checkbox.addEventListener("change", () => setFeat(feat.key, checkbox.checked ? 1 : 0));

        row.prepend(checkbox);
        row.append(text);
    }

    return row;
}

function renderFeats() {
    const groups = new Map();

    for (const feat of featsFor(state.className)) {
        if (!groups.has(feat.group)) {
            groups.set(feat.group, []);
        }

        groups.get(feat.group).push(feat);
    }

    const children = [];

    for (const [group, feats] of groups) {
        children.push(element("div", "rolls-title feature-group", group));
        children.push(...feats.map(featRow));
    }

    $("featList").replaceChildren(...children);

    const taken = takenFeats();
    const allowed = featsAllowed(state.level);

    $("featSummary").textContent = unusedFeats()
        ? `${unusedFeats()} to choose · ${taken} / ${allowed} taken`
        : `${taken} / ${allowed} taken`;
    $("featSummary").classList.toggle("warning", taken > allowed);
    $("featSummary").classList.toggle("attention", unusedFeats() > 0);
}

/* Only redrawn while open: the list is long. */
function renderIfOpen() {
    if (!featuresOverlay.classList.contains("hidden")) {
        renderFeatures();
        renderFeats();
    }
}

$("featuresButton").addEventListener("click", () => {
    renderFeatures();
    renderFeats();

    show(featuresOverlay);
});

$("closeFeatures").addEventListener("click", () => hide(featuresOverlay));

onStateChange(renderIfOpen);
