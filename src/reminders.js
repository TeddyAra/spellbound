import { $, element } from "./dom.js";
import {
    state,
    onStateChange,
    characterClass,
    featCount,
    rawRank,
    rankPointsLeft,
    schoolsOverCap,
    schoolName
} from "./state.js";
import { RANKED_SCHOOLS, SUBCLASS_LEVEL, featsAllowed, featsFor, rankCap } from "./rules.js";

/*
 * Little markers on the top buttons when a character has something left to
 * choose (rank points, feats, a subclass, a passion) or something that
 * doesn't add up (too many points, a school over the cap).
 */

/* Points left to spend, if any school can still go up. */
export function unspentRanks() {
    const room = RANKED_SCHOOLS.reduce((total, school) => total + Math.max(0, rankCap(state.level) - rawRank(school)), 0);

    return Math.max(0, Math.min(rankPointsLeft(), room));
}

export const takenFeats = () => featsFor(state.className).reduce((total, feat) => total + featCount(feat.key), 0);

export const unusedFeats = () => Math.max(0, featsAllowed(state.level) - takenFeats());

export const needsSubclass = () => state.level >= SUBCLASS_LEVEL && !characterClass().subclasses[state.subclass];

export const needsPassion = () => !state.passionName.trim();

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const unchosen = choices => choices.filter(choice => !choice).length;

/* What's left to choose (or fix) in Character settings. */
function characterReminders() {
    const reminders = [];

    if (unspentRanks()) {
        reminders.push(`${plural(unspentRanks(), "rank point")} to spend`);
    }

    if (rankPointsLeft() < 0) {
        reminders.push(`${plural(-rankPointsLeft(), "rank point")} too many spent`);
    }

    for (const school of schoolsOverCap()) {
        reminders.push(`${schoolName(school)} is over the rank cap`);
    }

    if (unchosen(state.bonusChoices)) {
        reminders.push(`Choose ${plural(unchosen(state.bonusChoices), "bonus rank")}`);
    }

    if (unchosen(state.expertSchools)) {
        reminders.push("Choose your Expert schools");
    }

    if (needsSubclass()) {
        reminders.push("Choose a subclass");
    }

    if (needsPassion()) {
        reminders.push("Name your passion");
    }

    if (unchosen(state.tongues)) {
        reminders.push(`Choose ${plural(unchosen(state.tongues), "Tongue")}`);
    }

    return reminders;
}

function featureReminders() {
    const reminders = [];

    if (unusedFeats()) {
        reminders.push(`${plural(unusedFeats(), "feat")} to choose`);
    }

    if (unchosen(state.trainedSchools)) {
        reminders.push("Choose a school for Trained");
    }

    return reminders;
}

/* A dot with a count on a top button, and the reasons in its tooltip. */
function setBadge(buttonId, label, reminders) {
    const button = $(buttonId);
    let badge = button.querySelector(".badge");

    if (!reminders.length) {
        badge?.remove();
        button.title = label;

        return;
    }

    if (!badge) {
        badge = element("span", "badge");
        button.append(badge);
    }

    badge.textContent = reminders.length;
    button.title = `${label}\n\n${reminders.map(reminder => `• ${reminder}`).join("\n")}`;
}

/* Marks a field in a settings window that still needs filling in. */
function markField(id, missing) {
    $(id).classList.toggle("needs-attention", missing);
}

function renderReminders() {
    setBadge("characterButton", "Character settings", characterReminders());
    setBadge("featuresButton", "Features and feats", featureReminders());

    markField("subclassInput", needsSubclass());
    markField("passionNameInput", needsPassion());
}

onStateChange(renderReminders);
