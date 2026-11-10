import { $, element } from "./dom.js";
import { preference, setPreference } from "./preferences.js";
import { GLOSSARY } from "./glossary.js";
import { buildIndex, search, queryTokens, snippet, matchRanges, suggestions } from "./rulebook.js";

/*
 * Searching the rulebook, from the top of the quick reference (see
 * reference.js). While searching, the quick reference makes way for the
 * search: suggestions while the box is empty, then results as you type, and
 * a section in full once you open one.
 *
 * It searches the real rulebook (rulebook.md, see rulebook.js) and the
 * glossary, and says which version of the rulebook that is. The DM chapters
 * are only searched when the toggle is on. Every section opened is counted,
 * so the ones you open most become the suggestions.
 *
 * The rulebook is loaded shortly after the page, as a file of its own, so it
 * doesn't slow the start down. Offline it's there too (see serviceWorker.js).
 */

const input = $("rulesSearchInput");
const closeButton = $("rulesSearchClose");
const dmToggle = $("rulesSearchDM");
const panel = $("rulesSearchPanel");
const quickReference = $("referenceContent");

let index = null;
let searching = false;

// The section being read: { id, whole } (whole: its entire chapter), and where it was opened from
let reading = null;

const loading = new Promise(resolve => {
    const load = () => import("../rulebook.md?raw").then(module => {
        index = buildIndex(module.default, GLOSSARY);
        input.placeholder = `Search rulebook ${index.version}`;
        resolve();
    });

    // Once the page has drawn, not while it's starting up
    if (document.readyState === "complete") {
        setTimeout(load, 500);
    } else {
        window.addEventListener("load", () => setTimeout(load, 500), { once: true });
    }
});

const version = () => `rulebook ${index.version}`;
const sectionById = id => index.sections.find(section => section.id === id);

/*
 * =========================================================
 * TEXT
 * =========================================================
 */

/* Bold, italics and links, as elements. */
function inlines(parts) {
    return parts.map(part => {
        let node = document.createTextNode(part.text);

        if (part.href) {
            const link = element("a");

            link.href = part.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.append(node);
            node = link;
        }

        for (const [on, tag] of [[part.italic, "em"], [part.bold, "strong"]]) {
            if (on) {
                const wrapper = element(tag);

                wrapper.append(node);
                node = wrapper;
            }
        }

        return node;
    });
}

function withInlines(tag, className, parts) {
    const node = element(tag, className);

    node.append(...inlines(parts));

    return node;
}

/* A section's blocks (see parseBlocks in rulebook.js) as elements. */
function renderBlocks(blocks) {
    return blocks.map(block => {
        switch (block.type) {
            case "heading":
                return withInlines("h5", "rules-subheading", block.inlines);
            case "paragraph":
                return withInlines("p", block.line ? "rules-line" : null, block.inlines);
            case "list": {
                const list = element(block.ordered ? "ol" : "ul");

                list.append(...block.items.map(item => withInlines("li", null, item)));

                return list;
            }
            case "table": {
                const scroll = element("div", "rules-table-scroll");
                const table = element("table", "reference-table");
                const head = element("tr");
                const body = element("tbody");

                head.append(...block.head.map(cell => {
                    const th = withInlines("th", "rank-grid-head", cell);
                    th.scope = "col";
                    return th;
                }));

                body.append(...block.rows.map(row => {
                    const tr = element("tr");
                    tr.append(...row.map(cell => withInlines("td", null, cell)));
                    return tr;
                }));

                const thead = element("thead");
                thead.append(head);
                table.append(thead, body);
                scroll.append(table);

                return scroll;
            }
            case "rule":
                return element("hr", "rules-rule");
            case "box": {
                const box = element("div", `rules-box rules-box-${block.kind}`);

                box.append(...renderBlocks(block.children));

                return box;
            }
            default:
                return document.createTextNode("");
        }
    });
}

/* Text with the search words marked. */
function marked(text, tokens) {
    const nodes = [];
    let at = 0;

    for (const [start, end] of matchRanges(text, tokens)) {
        nodes.push(text.slice(at, start), element("mark", "rules-mark", text.slice(start, end)));
        at = end;
    }

    nodes.push(text.slice(at));

    return nodes.filter(node => node !== "");
}

/* Marks the search words in everything already drawn inside a node. */
function markWithin(node, tokens) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];

    while (walker.nextNode()) {
        texts.push(walker.currentNode);
    }

    for (const text of texts) {
        if (matchRanges(text.nodeValue, tokens).length) {
            text.replaceWith(...marked(text.nodeValue, tokens));
        }
    }
}

const breadcrumb = path => path.slice(0, -1).join(" › ");

function dmTag() {
    return element("span", "rules-tag rules-tag-dm", "DM");
}

/*
 * =========================================================
 * VIEWS
 * =========================================================
 */

function status(text) {
    return element("p", "rules-search-status", text);
}

function suggestionsView() {
    const history = preference("rulesSearchHistory");
    const looked = Object.keys(history ?? {}).length > 0;
    const list = element("div", "rules-suggestions");

    list.append(...suggestions(history, index.sections, { dm: preference("rulesSearchDM") }).map(section => {
        const chip = element("button", "rules-suggestion");

        chip.type = "button";
        chip.append(element("strong", null, section.title));

        if (section.path.length > 1) {
            chip.append(element("small", null, breadcrumb(section.path)));
        }

        chip.addEventListener("click", () => openSection(section.id));

        return chip;
    }));

    return [
        status(`Searching ${version()}${preference("rulesSearchDM") ? ", DM chapters included" : ""}.`),
        element("h3", "rules-search-heading", looked ? "Frequently looked up" : "Often looked up"),
        list
    ];
}

function glossaryResult(entry, tokens) {
    const card = element("div", "rules-result rules-result-glossary");
    const top = element("span", "rules-result-top");

    top.append(element("span", "rules-tag", "Glossary"));
    card.append(top, element("strong", "rules-result-title", entry.term), element("span", "rules-snippet", entry.meaning));
    markWithin(card.querySelector(".rules-result-title"), tokens);
    markWithin(card.querySelector(".rules-snippet"), tokens);

    return card;
}

function sectionResult(section, tokens) {
    const button = element("button", "rules-result");
    const top = element("span", "rules-result-top");
    // From the prose when the words are there, since a table's cells run together on one line
    const piece = snippet(matchRanges(section.prose, tokens).length ? section.prose : section.text, tokens);
    const text = element("span", "rules-snippet");

    button.type = "button";

    if (section.path.length > 1) {
        top.append(element("span", "rules-path", breadcrumb(section.path)));
    }

    if (section.dm) {
        top.append(dmTag());
    }

    text.append(piece.before ? "…" : "", ...marked(piece.text, tokens), piece.after ? "…" : "");

    const title = element("strong", "rules-result-title");
    title.append(...marked(section.title, tokens));

    button.append(...(top.childNodes.length ? [top] : []), title, text);
    button.addEventListener("click", () => openSection(section.id));

    return button;
}

function resultsView(query) {
    const dm = preference("rulesSearchDM");
    const tokens = queryTokens(query);
    const results = search(index, query, { dm });
    const views = [];

    views.push(status(results.length
        ? `${results.length === 40 ? "The best 40" : results.length} result${results.length === 1 ? "" : "s"} in ${version()}${dm ? ", DM chapters included" : ""}`
        : `Nothing in ${version()} matches “${query.trim()}”.`));

    const list = element("div", "rules-results");

    list.append(...results.map(({ entry }) => entry.term ? glossaryResult(entry, tokens) : sectionResult(entry, tokens)));
    views.push(list);

    // What the DM chapters would add
    if (!dm) {
        const more = search(index, query, { dm: true }).filter(({ entry }) => entry.dm).length;

        if (more) {
            const button = element("button", "rules-more-button", `${more} more in the DM chapters`);

            button.type = "button";
            button.addEventListener("click", () => {
                setPreference("rulesSearchDM", true);
                render();
            });

            views.push(button);
        }
    }

    return views;
}

function sectionView({ id, whole }) {
    const section = sectionById(id);
    const tokens = queryTokens(input.value);
    const bar = element("div", "rules-article-bar");
    const back = element("button", "rules-back", input.value.trim() ? "‹ Results" : "‹ Suggestions");
    const article = element("article", "rules-article");

    back.type = "button";
    back.addEventListener("click", () => {
        reading = null;
        render();
        input.focus({ preventScroll: true });
    });

    bar.append(back, element("span", "rules-path", whole ? `${version()}` : `${breadcrumb(section.path) || section.chapter} · ${version()}`));

    if (section.dm) {
        bar.append(dmTag());
    }

    const shown = whole ? index.sections.filter(other => other.chapter === section.chapter) : [section];

    for (const part of shown) {
        const wrapper = element("section", "rules-part");
        const level = Math.min(part.path.length + 1, 4);

        wrapper.dataset.id = part.id;
        wrapper.classList.toggle("current", whole && part.id === id);
        wrapper.append(element(`h${level + 1}`, `rules-title rules-title-${part.path.length}`, part.title), ...renderBlocks(part.blocks));
        article.append(wrapper);
    }

    if (tokens.length) {
        markWithin(article, tokens);
    }

    const views = [bar, article];

    if (!whole && shown[0].path.length > 1) {
        const all = element("button", "rules-more-button", `Read all of ${section.chapter}`);

        all.type = "button";
        all.addEventListener("click", () => {
            reading = { id, whole: true };
            render();
        });

        views.push(all);
    }

    return views;
}

/*
 * =========================================================
 * STATE
 * =========================================================
 */

function render() {
    dmToggle.checked = preference("rulesSearchDM");

    quickReference.classList.toggle("hidden", searching);
    panel.classList.toggle("hidden", !searching);
    closeButton.classList.toggle("hidden", !searching);

    if (!searching) {
        return;
    }

    if (!index) {
        panel.replaceChildren(status("Loading the rulebook…"));
        loading.then(render);
        return;
    }

    const query = input.value;

    panel.replaceChildren(...(reading ? sectionView(reading) : query.trim() ? resultsView(query) : suggestionsView()));

    if (reading?.whole) {
        panel.querySelector(".rules-part.current")?.scrollIntoView({ block: "start" });
    } else {
        panel.scrollTop = 0;
    }
}

function openSection(id) {
    const history = { ...preference("rulesSearchHistory") };

    history[id] = (history[id] ?? 0) + 1;
    setPreference("rulesSearchHistory", history);

    reading = { id, whole: false };
    render();
}

function startSearching() {
    if (!searching) {
        searching = true;
        render();
    }
}

function stopSearching() {
    searching = false;
    reading = null;
    input.value = "";
    render();
}

input.addEventListener("focus", startSearching);

input.addEventListener("input", () => {
    searching = true;
    reading = null;
    render();
});

// Escape clears the search, then closes it, before it closes the window (see overlays.js)
input.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !searching) {
        return;
    }

    event.stopPropagation();

    if (input.value) {
        input.value = "";
        reading = null;
        render();
    } else {
        stopSearching();
        input.blur();
    }
});

closeButton.addEventListener("click", stopSearching);

dmToggle.addEventListener("change", () => {
    setPreference("rulesSearchDM", dmToggle.checked);
    render();
});

// The window always opens on the quick reference
$("referenceButton").addEventListener("click", stopSearching);

render();
