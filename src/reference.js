import { $, show, hide, element } from "./dom.js";
import { TONGUES } from "./rules.js";
import { GLOSSARY } from "./glossary.js";

/*
 * The rulebook's Appendix A, the quick reference, in three columns that fit
 * on screen without scrolling, and Appendix B, the glossary, which fills what
 * is left of the last column and opens in full in its own window. Tables
 * sit in cards and use the rank grid's header style, so every theme dresses
 * them like the rest of its windows.
 */

/* A heading and a table: { title, head: [...], rows: [[...], ...], note } */
function tableSection({ title, head, rows, note, firstColumnHead = false }) {
    const card = element("section", "feature-card reference-card");
    const table = element("table", "reference-table");
    const headRow = element("tr");

    card.append(element("h3", null, title));

    for (const cell of head) {
        const th = element("th", "rank-grid-head", cell);

        th.scope = "col";
        headRow.append(th);
    }

    const body = element("tbody");

    for (const row of rows) {
        const tr = element("tr");

        row.forEach((cell, index) => {
            const isHead = firstColumnHead && index === 0;
            const td = element(isHead ? "th" : "td", isHead ? "rank-grid-head" : null, cell);

            if (isHead) {
                td.scope = "row";
            }

            tr.append(td);
        });

        body.append(tr);
    }

    const thead = element("thead");

    thead.append(headRow);
    table.append(thead, body);

    // Wide tables scroll sideways inside their card rather than stretching the window
    const scroller = element("div", "reference-scroll");

    scroller.append(table);
    card.append(scroller);

    if (note) {
        card.append(element("p", null, note));
    }

    return card;
}

/* A heading and a few lines of text, or a numbered list. */
function textSection(title, lines, ordered = false) {
    // Text sections take the spare height, so the columns end level (see style.css)
    const card = element("section", "feature-card reference-card stretch");

    card.append(element("h3", null, title));

    if (ordered) {
        const list = element("ol");

        for (const [label, text] of lines) {
            const item = element("li");

            item.append(element("strong", null, `${label}. `), text);
            list.append(item);
        }

        card.append(list);
    } else {
        for (const line of lines) {
            card.append(element("p", null, line));
        }
    }

    return card;
}


/*
 * =========================================================
 * APPENDIX A
 * =========================================================
 */

const SECTIONS = {
    coreLoop: () => textSection("The Core Loop", [
        ["Pre-turn", "Name a school, and whether you cast a new spell, a saved spell, or take a mundane action. Get a DC and roll your casting pool."],
        ["Read the roll", "Succeed if any die equals or beats the DC. Count surges (dice showing 5+) for your level. For a new spell, draw tiles equal to the total."],
        ["Casting turn", "Spell it, bend it, keep tiles if you can't spell, or describe your mundane action. Move and take a bonus action if something allows it."]
    ], true),

    castingPools: () => tableSection({
        title: "Casting Pools",
        head: ["Rank", "1", "2", "3", "4", "5", "6", "7", "8"],
        rows: [["Pool", "1d6", "2d6", "3d6", "4d6", "4d8", "5d8", "5d10", "5d12"]],
        firstColumnHead: true
    }),

    difficulty: () => tableSection({
        title: "Difficulty",
        head: ["DC", "Difficulty", "Lowest rank"],
        rows: [
            ["2–6", "Trivial to very hard", "1"],
            ["7–8", "Heroic", "5"],
            ["9–10", "Legendary", "7"],
            ["11–12", "Mythic", "8"]
        ]
    }),

    effectDice: () => tableSection({
        title: "Effect Dice",
        head: ["Action", "Effect dice", "Several targets"],
        rows: [
            ["Harm spell", "1d8 per level", "Share, at least one die each"],
            ["Aid spell (heal)", "1d8 per level", "Share, at least one die each"],
            ["Aid spell (ward)", "Absorbs 1d8 per level until your next turn", "Share, at least one die each"],
            ["Passion spell", "1d6 per level", "Share, at least one die each"],
            ["Weapon attack", "Weapon die per level", "—"],
            ["First aid", "1d4 per level", "—"]
        ],
        note: "A spell can affect as many creatures as it has effect dice."
    }),

    creationQuality: () => tableSection({
        title: "Creation Quality",
        head: ["Level", "Quality", "Largest size"],
        rows: [
            ["1", "Crude: a chipped, dull sword", "Something you can hold"],
            ["2", "Serviceable", "Something you can carry"],
            ["3", "Good, well made", "Furniture"],
            ["4", "Fine", "A cart"],
            ["5", "Masterwork", "A house"],
            ["6", "Exceptional", "A hall"],
            ["7", "Legendary", "A fortress"],
            ["8", "Wondrous", "A castle"]
        ]
    }),

    mundane: () => textSection("Mundane Actions", [
        "No tiles, no backfire, and a mortal limit of level 3 unless a feature raises it."
    ]),

    volume: () => tableSection({
        title: "Volume",
        head: ["Volume", "Range", "Heard within"],
        rows: [
            ["Whisper", "Touch", "5 feet"],
            ["Speak", "60 feet", "60 feet"],
            ["Shout", "120 feet", "300 feet"]
        ],
        note: "A door or thin wall makes you one step quieter. A thick stone wall makes you two steps quieter."
    }),

    savingThrows: () => tableSection({
        title: "Saving Throws",
        head: ["School", "Resists"],
        rows: [
            ["Move", "Being pushed, grabbed or knocked down; dodging"],
            ["Aid", "Poison, disease, exhaustion, heat and cold"],
            ["Reveal", "Illusions and tricks"],
            ["Control", "Charm, fear and mind control"]
        ],
        note: "Against a spell, the DC is its level + 3."
    }),

    lastingEffects: () => textSection("Lasting Effects", [
        "Change, Move and Control effects on an unwilling creature last 1 round per level. The target tries to break free at the end of each of its turns."
    ]),

    deathRolls: () => textSection("Death Rolls", [
        "At 0 hit points, roll a d20 at the start of every round. 10+ is a success, 9 or lower a failure. A natural 1 is two failures, and a natural 20 wakes you with 1 hit point. Three successes and you're stable, three failures and you die."
    ]),

    everyDie: () => tableSection({
        title: "Every Die's Job",
        head: ["Die", "Used for"],
        rows: [
            ["d4", "Light weapons, first aid, backfire damage"],
            ["d6", "Ranks 1–4, Passion spells, simple weapons"],
            ["d8", "Ranks 5–6, Harm and Aid spells, martial weapons"],
            ["d10", "Rank 7, heavy weapons"],
            ["d12", "Rank 8, maximum effect"],
            ["d20", "Initiative, death rolls"]
        ]
    }),

    tongues: () => tableSection({
        title: "Tongues",
        head: ["Tongue", "Perk"],
        rows: Object.values(TONGUES).map(tongue => [tongue.name, tongue.short]),
        note: "Only your native Tongue and Tongues you learned twice (fluent) give their perk. Knowing a spell's Tongue lets you lip-read or copy it. Countering, tiles, written spells, runes, potions and constructs don't need one."
    }),

    glossary: () => glossaryPreview()
};

/* Three columns of about the same height; the glossary fills what's left of the last. */
const COLUMNS = [
    ["coreLoop", "castingPools", "difficulty", "volume", "mundane", "lastingEffects"],
    ["effectDice", "savingThrows", "deathRolls", "everyDie"],
    ["creationQuality", "tongues", "glossary"]
];

/*
 * =========================================================
 * APPENDIX B: GLOSSARY
 * =========================================================
 */

function glossaryList() {
    const list = element("dl", "glossary-list");

    for (const [term, meaning] of GLOSSARY) {
        list.append(element("dt", null, term), element("dd", null, meaning));
    }

    return list;
}

/* As much of the glossary as fits, fading out at the bottom, with a button for the whole thing. */
function glossaryPreview() {
    const card = element("section", "feature-card reference-card glossary-card");
    const header = element("div", "glossary-header");
    const button = element("button", null, "View all");

    button.type = "button";
    button.addEventListener("click", () => show($("glossaryOverlay")));

    header.append(element("h3", null, "Glossary"), button);

    const preview = element("div", "glossary-preview");

    preview.setAttribute("aria-hidden", "true");
    preview.append(glossaryList());
    card.append(header, preview);

    return card;
}

/*
 * =========================================================
 * WINDOWS
 * =========================================================
 */

const referenceOverlay = $("referenceOverlay");

$("referenceContent").append(...COLUMNS.map(keys => {
    const column = element("div", "reference-column");

    column.append(...keys.map(key => SECTIONS[key]()));

    return column;
}));

$("glossaryContent").append(glossaryList());

$("referenceButton").addEventListener("click", () => show(referenceOverlay));
$("closeReference").addEventListener("click", () => hide(referenceOverlay));
$("closeGlossary").addEventListener("click", () => hide($("glossaryOverlay")));
