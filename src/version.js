/*
 * The app's version and what changed in each one, newest first. Shown in
 * Settings, which opens the list in a window of its own.
 *
 * The app's version follows the rulebook's (see "F: Changes" in rulebook.md):
 * a new rulebook version is a new app version. Smaller app changes in between
 * go under the newest version.
 */
export const CHANGELOG = [
    {
        version: "0.4",
        date: "2026-11-10",
        changes: [
            "Bigger screens: the menu keeps your HP, stats and rests at the top, with three pages below for Actions, Saves & senses and Saved spells",
            "Passive Reveal sits with the saving throws on the Saves & senses page, on every screen",
            "Search the rulebook from the quick reference, with the DM chapters behind a toggle and suggestions from what you look up most",
            "The version and this list of changes, in Settings",
            "Phone: a Saving throws page with the save buttons and passive Reveal, and Features next to Character",
            "Constructs: separate names for small constructs, a Modules button, the shared Guard DC in the panel, and resting that follows Field Repairs",
            "Tongues: fluent and well-spoken Tongues, with perks only from fluent ones",
            "Annotated Spells rolls for a saved spell's level",
            "Weapon buttons show the casting pool, and the Bladeword hints follow Weapon Mastery, Spellstorm and Charged Blade",
            "Trickster: the Cutthroat replaces the Gambler, with Vicious rerolling Ambush 1s",
            "New feats and a Combat group, with Heavy Armor Training, Fleet-Footed, Observant and Hard to Kill worked out by the app",
            "Races: choose one in Character settings for your size, speed, darkvision and a knack that raises a mortal limit, ticked when you roll",
            "Two or three new feats for every class, and Dirty Tricks replaces Dirty Fighting (characters who had it keep the feat slot)",
            "Inks and tools in the inventory",
            "Magic weapons from +1 to +3 in the inventory, and +1 armor and shields in Character settings",
            "The rulebook is updated to version 0.4"
        ]
    }
];

export const VERSION = CHANGELOG[0].version;

/* "2026-11-10" → "10 November 2026", without the time zone moving it a day. */
export function formatDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
