/*
 * The rulebook (rulebook.md) as searchable sections, for the rules search in
 * the quick reference (see rulesSearch.js). Nothing here touches the page, so
 * the tests can feed it the real rulebook.
 *
 * The rulebook is Homebrewery markdown: the usual markdown, plus page and
 * column breaks, {{wide}} and {{note}} boxes and a little HTML. Breaks and
 * layout boxes are dropped; notes and stat blocks are kept as boxes.
 *
 * A section is everything under one heading: a chapter's opening text (##),
 * a subsection (###), or a part of one (####). Smaller headings (#####) stay
 * inside their section.
 */

/* Chapters for the DM, searched only when the player asks for them. */
export const DM_CHAPTERS = [
    "Running Enemies",
    "Goblin Skirmisher",
    "Cult Acolyte",
    "Ogre Brute",
    "Ink Wyrm",
    "Judging Spells",
    "Appendix E: Feature Interactions"
];

/*
 * Chapters left out of the search: the glossary is searched in the app's own
 * copy (see glossary.js), the character sheet is blank fields, and the
 * changes describe old versions of the rules.
 */
export const LEFT_OUT = [
    "Appendix B: Glossary",
    "Appendix D: Character Sheet",
    "Appendix F: Changes"
];

/* Suggested before the player has looked anything up, as headings: [chapter, subsection, part]. */
export const DEFAULT_SUGGESTIONS = [
    ["Rolling the Dice", "Reading Your Roll"],
    ["Rolling the Dice", "Difficulty"],
    ["Spellcasting", "Bending the Rules"],
    ["Spellcasting", "Speaking Your Spell", "Volume"],
    ["Spellcasting", "Lasting Effects"],
    ["Rolling the Dice", "Saving Throws"],
    ["Health and Resting", "Resting"],
    ["Health and Resting", "Dropping to 0 Hit Points"]
];

// Boxes kept as boxes. Every other {{...}} only lays out the printed page.
const KEPT_BOXES = ["note", "monster"];

const HEADING = /^(#{1,6})\s+(.*)$/;

/*
 * =========================================================
 * WORDS
 * =========================================================
 */

export const slug = text => normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function normalize(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* Plurals count as the word: surges → surge, abilities → ability. */
export function stem(word) {
    if (word.length > 4 && word.endsWith("ies")) {
        return `${word.slice(0, -3)}y`;
    }

    if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
        return word.slice(0, -1);
    }

    return word;
}

const words = text => normalize(text).match(/[a-z0-9]+/g) ?? [];

// Too common to narrow a search down
const STOPWORDS = new Set(["a", "an", "the", "of", "to", "in", "on", "and", "or", "is", "for", "do", "does", "how", "what", "i", "my"]);

/* The search's words, stemmed, each once. Common words only count when they're all there is. */
export function queryTokens(query) {
    const all = [...new Set(words(query).map(stem))];
    const meaningful = all.filter(token => !STOPWORDS.has(token));

    return meaningful.length ? meaningful : all;
}

/* Whether a word matches a search word: starts with it, or for one letter, is it. */
const matches = (word, token) => token.length < 2 ? word === token : word.startsWith(token);

/*
 * =========================================================
 * INLINE TEXT: bold, italics and links
 * =========================================================
 */

/* "Roll **3d6**" → [{ text: "Roll " }, { text: "3d6", bold: true }] */
export function parseInline(source) {
    const parts = [];
    let bold = false;
    let italic = false;
    let buffer = "";

    const emit = () => {
        if (buffer) {
            parts.push({ text: buffer, bold, italic });
            buffer = "";
        }
    };

    for (let i = 0; i < source.length;) {
        if (source.startsWith("***", i)) {
            emit();
            bold = !bold;
            italic = !italic;
            i += 3;
        } else if (source.startsWith("**", i)) {
            emit();
            bold = !bold;
            i += 2;
        } else if (source[i] === "*") {
            emit();
            italic = !italic;
            i += 1;
        } else if (source[i] === "\\" && i + 1 < source.length) {
            buffer += source[i + 1];
            i += 2;
        } else {
            const link = source[i] === "[" && /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(source.slice(i));

            if (link) {
                emit();
                parts.push({ text: link[1], bold, italic, href: link[2] });
                i += link[0].length;
            } else {
                buffer += source[i];
                i += 1;
            }
        }
    }

    emit();

    return parts;
}

const inlineText = parts => parts.map(part => part.text).join("");

/*
 * =========================================================
 * BLOCKS: headings, paragraphs, lists, tables, boxes
 * =========================================================
 */

const tableCells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
const isDivider = cells => cells.every(cell => /^:?-+:?$/.test(cell));

/*
 * A section's lines as blocks:
 *   { type: "heading", level, inlines }
 *   { type: "paragraph", inlines, line }   line: a stat block's "Armor :: 1", on a line of its own
 *   { type: "list", ordered, items: [inlines] }
 *   { type: "table", head: [inlines], rows: [[inlines]] }
 *   { type: "rule" }
 *   { type: "box", kind: "note" | "monster", children: [blocks] }
 */
export function parseBlocks(lines) {
    const root = { children: [] };
    const open = [root];
    let paragraph = null;
    let list = null;
    let table = null;

    const add = block => open.at(-1).children.push(block);
    const end = () => {
        paragraph = null;
        list = null;
        table = null;
    };

    for (const raw of lines) {
        const line = raw.trim();
        const heading = HEADING.exec(line);
        const item = /^([-*]|\d+\.)\s+(.*)$/.exec(line);

        if (!line) {
            end();
        } else if (line.startsWith("{{")) {
            end();

            const box = { type: "box", kind: line.slice(2), children: [] };

            add(box);
            open.push(box);
        } else if (line === "}}") {
            end();

            if (open.length > 1) {
                open.pop();
            }
        } else if (heading) {
            end();
            add({ type: "heading", level: heading[1].length, inlines: parseInline(heading[2]) });
        } else if (/^(_{3,}|-{3,})$/.test(line)) {
            end();
            add({ type: "rule" });
        } else if (line.startsWith("|")) {
            paragraph = null;
            list = null;

            const cells = tableCells(line);

            if (isDivider(cells)) {
                continue;
            }

            if (table) {
                table.rows.push(cells.map(parseInline));
            } else {
                table = { type: "table", head: cells.map(parseInline), rows: [] };
                add(table);
            }
        } else if (item) {
            paragraph = null;
            table = null;

            const ordered = /\d/.test(item[1]);

            if (!list || list.ordered !== ordered) {
                list = { type: "list", ordered, items: [] };
                add(list);
            }

            list.items.push(parseInline(item[2]));
        } else if (line.includes(" :: ")) {
            end();
            add({ type: "paragraph", line: true, inlines: parseInline(line.replace(/\s*::\s*/, ": ")) });
        } else {
            list = null;
            table = null;

            if (paragraph) {
                paragraph.inlines.push({ text: " " }, ...parseInline(line));
            } else {
                paragraph = { type: "paragraph", inlines: parseInline(line) };
                add(paragraph);
            }
        }
    }

    return root.children;
}

/* The words of some blocks, a line per block. Without tables, it reads as prose (for snippets). */
export function blocksText(blocks, { tables = true } = {}) {
    return blocks.map(block => {
        switch (block.type) {
            case "heading":
            case "paragraph":
                return inlineText(block.inlines);
            case "list":
                return block.items.map(inlineText).join("\n");
            case "table":
                return tables ? [block.head, ...block.rows].map(row => row.map(inlineText).join("  ")).join("\n") : "";
            case "box":
                return blocksText(block.children, { tables });
            default:
                return "";
        }
    }).filter(Boolean).join("\n");
}

/*
 * =========================================================
 * THE RULEBOOK AS SECTIONS
 * =========================================================
 */

const decodeEntities = text => text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/* Without the page layout: breaks, layout boxes, the cover's small print and HTML tags. */
function cleanLines(source) {
    const lines = [];
    const boxes = [];
    let smallPrint = false;

    for (const raw of source.replace(/\r/g, "").split("\n")) {
        const line = raw.trim();

        if (smallPrint) {
            smallPrint = line !== "</div>";
        } else if (line.startsWith("<div style='position: absolute")) {
            // The version and legal notes at the bottom of the cover
            smallPrint = true;
        } else if (line === "\\page" || line === "\\column") {
            // Page and column breaks
        } else if (line.startsWith("{{")) {
            const kind = line.slice(2).split(/[,\s]/)[0];
            const kept = KEPT_BOXES.includes(kind);

            boxes.push(kept);

            if (kept) {
                lines.push(`{{${kind}`);
            }
        } else if (line === "}}") {
            if (boxes.pop()) {
                lines.push("}}");
            }
        } else {
            lines.push(decodeEntities(raw.replace(/<br\s*\/?>/gi, " ").replace(/<\/?[a-z][^>]*>/gi, "")));
        }
    }

    // A box that opens right above a heading belongs to that heading's section (a stat block's name)
    for (let i = 0; i < lines.length - 1; i++) {
        const next = lines.slice(i + 1).findIndex(line => line.trim()) + i + 1;

        if (lines[i].startsWith("{{") && HEADING.test(lines[next]?.trim() ?? "") && HEADING.exec(lines[next].trim())[1].length <= 4) {
            [lines[i], lines[next]] = [lines[next], lines[i]];
        }
    }

    return lines;
}

/* The version on the cover: "Version 0.4, playtest edition." */
export const rulebookVersion = source => /Version (\d+(?:\.\d+)+)/.exec(source)?.[1] ?? null;

function makeSection(path, order, ids) {
    let id = path.map(slug).join("/");

    // Two subsections of one chapter with the same name (Example)
    for (let n = 2; ids.has(id); n++) {
        id = `${path.map(slug).join("/")}-${n}`;
    }

    ids.add(id);

    return { id, path, chapter: path[0], title: path.at(-1), order, lines: [] };
}

/*
 * The searchable sections, in the rulebook's order:
 *   { id, path: [chapter, subsection, part], chapter, title, dm, blocks, text, prose, order }
 * text has everything; prose leaves the tables out, for snippets.
 */
export function parseRulebook(source) {
    const sections = [];
    const ids = new Set();
    let current = null;
    let chapter = null;
    let subsection = null;

    for (const line of cleanLines(source)) {
        const heading = HEADING.exec(line.trim());
        const level = heading?.[1].length;

        if (level === 1) {
            current = null;
        } else if (level === 2) {
            chapter = heading[2].trim();
            subsection = null;
            current = makeSection([chapter], sections.length, ids);
            sections.push(current);
        } else if (level === 3 && chapter) {
            subsection = heading[2].trim();
            current = makeSection([chapter, subsection], sections.length, ids);
            sections.push(current);
        } else if (level === 4 && chapter) {
            current = makeSection([chapter, subsection, heading[2].trim()].filter(Boolean), sections.length, ids);
            sections.push(current);
        } else if (current) {
            current.lines.push(line);
        }
    }

    return sections
        .filter(section => !LEFT_OUT.includes(section.chapter))
        .map(({ lines, ...section }) => {
            const blocks = parseBlocks(lines);

            return {
                ...section,
                dm: DM_CHAPTERS.includes(section.chapter),
                blocks,
                text: blocksText(blocks),
                prose: blocksText(blocks, { tables: false })
            };
        })
        // A heading straight above another, with nothing of its own
        .filter(section => section.text.trim());
}

/* The glossary as search entries of its own: { id, term, meaning } */
export const glossaryEntries = glossary => glossary.map(([term, meaning]) => ({ id: `glossary/${slug(term)}`, term, meaning }));

/*
 * =========================================================
 * SEARCHING
 * =========================================================
 */

/* What's searched in a section or glossary entry, worked out once. */
function searchFields(entry) {
    if (entry.term) {
        return { title: words(entry.term).map(stem), path: [], heads: [], defined: [], body: words(entry.meaning).map(stem), titleText: normalize(entry.term), bodyText: normalize(entry.meaning) };
    }

    const heads = [];
    const defined = [];
    const boldIn = parts => parts.filter(part => part.bold).forEach(part => defined.push(part.text));
    const collect = blocks => blocks.forEach(block => {
        if (block.type === "heading") {
            heads.push(inlineText(block.inlines));
        } else if (block.type === "box") {
            collect(block.children);
        } else if (block.type === "paragraph") {
            boldIn(block.inlines);
        } else if (block.type === "list") {
            block.items.forEach(boldIn);
        }
    });

    collect(entry.blocks);

    return {
        title: words(entry.title).map(stem),
        path: entry.path.slice(0, -1).flatMap(words).map(stem),
        heads: heads.flatMap(words).map(stem),
        // Rules terms are in bold where they're explained
        defined: defined.flatMap(words).map(stem),
        body: words(entry.text).map(stem),
        titleText: normalize(entry.title),
        bodyText: normalize(entry.text)
    };
}

/* The rulebook and glossary, ready to search. */
export function buildIndex(source, glossary = []) {
    const sections = parseRulebook(source);
    const entries = [...sections, ...glossaryEntries(glossary)];

    return {
        version: rulebookVersion(source),
        sections,
        entries: entries.map(entry => ({ entry, fields: searchFields(entry) }))
    };
}

function score({ fields, entry }, tokens, phrase) {
    let total = 0;

    for (const token of tokens) {
        const count = list => list.filter(word => matches(word, token)).length;
        const inTitle = count(fields.title);
        const inBody = count(fields.body);
        const found = inTitle || count(fields.heads) || count(fields.path) || inBody;

        // Every word has to be there somewhere
        if (!found) {
            return 0;
        }

        total += (inTitle ? 12 : 0) +
            (fields.title.includes(token) ? 4 : 0) +
            (count(fields.heads) ? 6 : 0) +
            (count(fields.defined) ? 8 : 0) +
            (count(fields.path) ? 4 : 0) +
            Math.min(inBody, 8);
    }

    if (fields.titleText === phrase) {
        total += 25;
    } else if (tokens.length > 1 && fields.titleText.includes(phrase)) {
        total += 15;
    }

    if (tokens.length > 1 && fields.bodyText.includes(phrase)) {
        total += 6;
    }

    // A term looked up by name: the glossary says it best in a line
    if (entry.term && total) {
        total += 4;
    }

    return total;
}

/*
 * The best matches first: [{ entry, score }]. DM chapters only when asked
 * for, and then marked by entry.dm.
 */
export function search(index, query, { dm = false, limit = 40 } = {}) {
    const tokens = queryTokens(query);

    if (!tokens.length) {
        return [];
    }

    const phrase = words(query).join(" ");

    return index.entries
        .filter(({ entry }) => dm || !entry.dm)
        .map(item => ({ entry: item.entry, score: score(item, tokens, phrase) }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score || (a.entry.order ?? Infinity) - (b.entry.order ?? Infinity))
        .slice(0, limit);
}

/*
 * =========================================================
 * SHOWING MATCHES
 * =========================================================
 */

/* Where the search words are in a text: [[start, end]], for highlighting. */
export function matchRanges(text, tokens) {
    const ranges = [];

    for (const found of text.matchAll(/[\p{L}\p{N}]+/gu)) {
        const word = stem(normalize(found[0]));

        if (tokens.some(token => matches(word, token))) {
            ranges.push([found.index, found.index + found[0].length]);
        }
    }

    return ranges;
}

/*
 * A short piece of a section around its first match, on one line:
 * { text, ranges, before, after }, where before and after say whether text
 * was cut off there.
 */
export function snippet(text, tokens, length = 170) {
    const flat = text.replace(/\s+/g, " ").trim();
    const first = matchRanges(flat, tokens)[0];
    let start = first ? Math.max(0, first[0] - 50) : 0;

    // Starts at a word, unless that's the very beginning
    if (start > 0) {
        const space = flat.indexOf(" ", start);
        start = space === -1 || space > (first?.[0] ?? start) ? start : space + 1;
    }

    let end = Math.min(flat.length, start + length);

    if (end < flat.length) {
        const space = flat.lastIndexOf(" ", end);
        end = space > start ? space : end;
    }

    const piece = flat.slice(start, end);

    return { text: piece, ranges: matchRanges(piece, tokens), before: start > 0, after: end < flat.length };
}

/* Which suggestions to show: the most looked up first, then the defaults, each once. */
export function suggestions(history, sections, { dm = false, count = 8 } = {}) {
    const byId = new Map(sections.map(section => [section.id, section]));
    const allowed = section => section && (dm || !section.dm);

    const frequent = Object.entries(history ?? {})
        .filter(([id]) => allowed(byId.get(id)))
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => byId.get(id));

    const defaults = DEFAULT_SUGGESTIONS
        .map(path => byId.get(path.map(slug).join("/")))
        .filter(allowed);

    return [...new Set([...frequent, ...defaults])].slice(0, count);
}
