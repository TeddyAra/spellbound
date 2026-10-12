/*
 * The Spellbound rules the dashboard needs: casting pools, advancement,
 * classes and feats. Texts are short versions of the rulebook's.
 */

/*
 * =========================================================
 * SCHOOLS AND CASTING POOLS
 * =========================================================
 */

// Every school except Passion, which follows the highest of these
export const RANKED_SCHOOLS = ["harm", "aid", "change", "move", "control", "reveal", "create"];

export const MAGIC_SCHOOLS = [...RANKED_SCHOOLS, "passion"];

export const MAX_RANK = 8;

// Rank → [number of dice, die size]
const CASTING_POOLS = {
    1: [1, 6],
    2: [2, 6],
    3: [3, 6],
    4: [4, 6],
    5: [4, 8],
    6: [5, 8],
    7: [5, 10],
    8: [5, 12]
};

export function castingPool(rank) {
    const [count, sides] = CASTING_POOLS[Math.min(Math.max(rank, 1), MAX_RANK)];

    return { count, sides };
}

export function poolNotation(rank) {
    const { count, sides } = castingPool(rank);

    return `${count}d${sides}`;
}

// Schools that can be rolled as a saving throw, and what they resist
export const SAVING_THROWS = {
    move: "Being pushed, grabbed or knocked down; dodging",
    aid: "Poison, disease, exhaustion, heat and cold",
    reveal: "Illusions and tricks",
    control: "Charm, fear and mind control"
};

export const SPELL_LEVEL_SCALE = {
    1: "Minor magic affecting one creature or object",
    2: "Several targets, or a stronger effect",
    3: "A group, or a notable effect",
    4: "Large scale, with significant impact",
    5: "A room or a small building",
    6: "Great magic",
    7: "Legendary magic",
    8: "Mythic magic, rarely seen"
};

export const CREATION_QUALITY = {
    1: "Crude, something you can hold",
    2: "Serviceable, something you can carry",
    3: "Good, the size of furniture",
    4: "Fine, the size of a cart",
    5: "Masterwork, the size of a house",
    6: "Exceptional, the size of a hall",
    7: "Legendary, the size of a fortress",
    8: "Wondrous, the size of a castle"
};

// Weapon die → type
export const WEAPON_TYPES = {
    4: "Light",
    6: "Simple",
    8: "Martial",
    10: "Heavy"
};

// Armor value → type
export const ARMOR_TYPES = ["None", "Light", "Medium", "Heavy"];

/* d6 → d8 → d10 → d12, `steps` times. */
export function biggerDie(sides, steps = 1) {
    return Math.min(12, sides + 2 * steps);
}

/*
 * Several targets: a spell's effect dice are shared between its targets, at
 * least one each, so it can have as many targets as it has dice. This splits
 * them as evenly as possible, bigger shares first: 5 dice over 2 → [3, 2].
 */
export function splitDice(count, targets) {
    return Array.from({ length: targets }, (_, target) =>
        Math.floor(count / targets) + (target < count % targets ? 1 : 0));
}

/*
 * =========================================================
 * ADVANCEMENT
 * =========================================================
 */

export const MAX_LEVEL = 12;

// Index = character level − 1
const RANK_CAPS = [4, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8];
const SPELL_SLOTS = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];

export const rankCap = level => RANK_CAPS[level - 1];

export const baseSpellSlots = level => SPELL_SLOTS[level - 1];

/*
 * Rank points to spread over the schools: 10 at level 1, one more every
 * level. Every school starts at rank 1, and class bonus ranks come on top.
 */
export const rankPoints = level => 9 + level;

/* One feat per level, two at levels 4, 8 and 12. */
export function featsAllowed(level) {
    return level + [4, 8, 12].filter(extra => level >= extra).length;
}

/* Signature ability uses (or glyphs for the Runesmith): 2 at level 1, 3 at 5, 4 at 9. */
export function signatureUses(className, level) {
    const uses = level >= 9 ? 4 : level >= 5 ? 3 : 2;

    return className === "runesmith" ? uses - 1 : uses;
}

/* Runesmith: runes held at once. 1 at level 1, then one more at 3, 6, 9 and 12. */
export function runesAllowed(level) {
    return 1 + [3, 6, 9, 12].filter(extra => level >= extra).length;
}

export const SUBCLASS_LEVEL = 2;

/*
 * =========================================================
 * TONGUES
 * =========================================================
 *
 * The grammar a spell is cast in. Knowing a spell's Tongue lets you read
 * or copy its magic; each Tongue you know also gives a small perk.
 * Everyone starts with two (the first is their native Tongue), and Polyglot
 * teaches one more each time it's taken.
 */

export const STARTING_TONGUES = 2;

export const TONGUES = {
    hearthspeech: {
        name: "Hearthspeech",
        spokenBy: "Common folk, most travellers",
        perk: "Small Comforts",
        text: "Outside of combat, do trivial magic without rolling or drawing tiles: light a candle, warm a meal, clean a muddy cloak. It can't harm anyone, and isn't a spell you can save."
    },
    deepcant: {
        name: "Deepcant",
        spokenBy: "Dwarves, underground creatures",
        perk: "Stone Echo",
        text: "Tap a stone surface and listen: you learn the shape of the tunnels, rooms and hollow spaces within 30 feet, even in total darkness. It doesn't reveal creatures."
    },
    leafweave: {
        name: "Leafweave",
        spokenBy: "Elves, fey, druids",
        perk: "Green Words",
        text: "Share simple ideas with animals and plants, like \"danger\" or \"which way did they go?\" They understand you, but don't have to obey."
    },
    ashen: {
        name: "Ashen",
        spokenBy: "Dragons, giants, demons",
        perk: "Old Authority",
        text: "Dragons and other ancient creatures that know Ashen will hear you out before they attack, and weaker creatures easily become frightened."
    },
    drowned: {
        name: "Drowned Tongue",
        spokenBy: "Sailors, merfolk, sea witches",
        perk: "Deep Voice",
        text: "You can speak, and cast spoken spells, underwater. You still can't breathe there."
    },
    hollow: {
        name: "Hollow Tongue",
        spokenBy: "The undead, cultists, things from beyond",
        perk: "Death's Ear",
        text: "When a creature speaks, you can tell how close it is to death: unhurt, wounded, badly hurt, or barely standing."
    }
};

/*
 * =========================================================
 * CLASSES
 * =========================================================
 */

/*
 * signature:     the class's signature ability. Lasts `rounds` rounds once
 *                started, or until the end of the combat (untilCombatEnds)
 * rankBonus:     bonus ranks the class always adds to a school
 * bonusChoices:  bonus ranks the player puts in any school
 * armor:         heaviest armor allowed (see ARMOR_TYPES)
 * shield:        can use a shield
 * weapons:       weapon dice allowed (see WEAPON_TYPES)
 */
export const CLASSES = {
    wordweaver: {
        name: "Wordweaver",
        role: "Pure caster",
        hitDie: 6,
        fixedHP: 4,
        gear: "No armor. Light weapons.",
        bonusRanks: "3 ranks to any schools.",
        rankBonus: {},
        bonusChoices: 3,
        armor: 0,
        weapons: [4],
        extraSlots: 1,

        signature: {
            name: "Torrent of Words",
            rounds: 3,
            text: "Bonus action during your pre-turn, before you roll. Lasts 3 rounds, ends if you're downed. Every die that rolls 4 or higher counts as a surge."
        },

        features: [
            { level: 1, name: "Tile Craft", text: "Once per round, after your pre-turn, swap up to 2 of your tiles for random tiles from the pile." },
            { level: 1, name: "Deep Study", text: "You have one extra spell slot." },
            { level: 3, name: "Overchannel", text: "Once per round, after a successful pre-turn, raise your spell's level by 1, up to your rank. You take 1d8 damage." },
            { level: 6, name: "Blended Casting", text: "Name two schools and roll the lower-ranked one. If your spell fits both purposes, it does both." },
            { level: 9, name: "Echo", text: "Once per combat, skip your next pre-turn and cast the same spell again at the same level." },
            { level: 12, name: "Words of Making", text: "Once per long rest, a spell takes effect at level 8, however many surges you rolled." }
        ],

        subclasses: {
            lexicographer: {
                name: "Lexicographer",
                features: [
                    { level: 2, name: "Well-Read", text: "When you draw tiles for a new spell, draw 2 extra, then return any 2 to the pile." },
                    { level: 5, name: "Precise Wording", text: "Spells of 7 or more letters roll effect dice one size bigger." },
                    { level: 10, name: "Unabridged", text: "Once per combat, a spell that uses every tile you have (at least 6) takes effect 2 levels higher, up to your rank." }
                ]
            },
            devotee: {
                name: "Devotee",
                features: [
                    { level: 2, name: "Second Passion", text: "Choose a second passion, cast with your normal Passion rank." },
                    { level: 5, name: "Burning Passion", text: "Your Passion spells' effect dice are one size bigger, so d6s become d8s. This adds up with Spell Focus." },
                    { level: 10, name: "Kindred Passions", text: "Once per combat, a Passion spell tying into both passions takes effect 2 levels higher, up to 8." }
                ]
            },
            archivist: {
                name: "Archivist",
                features: [
                    { level: 2, name: "Catalogue", text: "2 extra spell slots. Roll twice to grow a saved spell and use the higher result." },
                    { level: 5, name: "Annotated Spells", text: "When you save a spell, it starts at level 2 instead of 1." },
                    { level: 10, name: "Grand Library", text: "Once per combat, cast two saved spells on the same casting turn. Roll for the lower-ranked school." }
                ]
            }
        },

        feats: [
            { key: "wordHoard", name: "Word Hoard", text: "Tile Craft lets you swap up to 4 tiles." },
            { key: "arcaneRecovery", name: "Arcane Recovery", text: "Once per long rest, after a short rest, roll to grow one of your saved spells." },
            { key: "longWords", name: "Long Words", minLevel: 4, text: "A spell containing a word of 8 or more letters takes effect 1 level higher, up to your rank." },
            { key: "sculptSpell", name: "Sculpt Spell", minLevel: 4, text: "Your area spells can leave out any creatures you choose." },
            { key: "multicast", name: "Multicast", minLevel: 8, text: "Cast two separate spells on one casting turn, each 1 level lower (minimum 1)." }
        ]
    },

    loresinger: {
        name: "Loresinger",
        role: "Support",
        hitDie: 8,
        fixedHP: 5,
        gear: "Light armor. Light and simple weapons.",
        bonusRanks: "1 to Aid, 1 to Control, 1 to any school.",
        rankBonus: { aid: 1, control: 1 },
        bonusChoices: 1,
        armor: 1,
        weapons: [4, 6],

        signature: {
            name: "Battle Hymn",
            rounds: 3,
            text: "Bonus action during your pre-turn. Lasts 3 rounds, ends if you're downed or silenced. Every ally who can hear you (within 60 feet) adds one die to their casting pool."
        },

        features: [
            { level: 1, name: "Silver Tongue", text: "Mundane Control actions have a mortal limit of 4." },
            { level: 1, name: "Shared Verse", text: "During the pre-turn phase, give up to 3 of your tiles to allies who can hear you." },
            { level: 1, name: "Inspiring Word", text: "Once per round, let an ally reroll one die of their casting pool." },
            { level: 3, name: "Countersong", text: "Once per combat, when an enemy reveals its spell, use your reaction to roll Control. Each surge lowers its level by 1. Below 1, it fizzles." },
            { level: 6, name: "Duet", text: "If you and an ally who shares a Tongue with you both succeeded on your pre-turns, combine tiles for one spell. Whoever comes first in initiative helps; it takes effect on the other's casting turn, at the higher level + 1, up to the higher rank." },
            { level: 9, name: "Rallying Refrain", text: "Anyone you heal or protect with Aid adds one die to their next casting pool." },
            { level: 12, name: "Anthem", text: "Once per long rest, every ally rolls their next pre-turn as if their rank were 1 higher, up to 8." }
        ],

        subclasses: {
            skald: {
                name: "Skald",
                features: [
                    { level: 2, name: "War Chant", text: "Medium armor and martial weapons. While Battle Hymn lasts, allies' weapon attacks deal an extra 1d4. Your Battle Hymn affects you too: one die more, and the extra 1d4." },
                    { level: 5, name: "Battle Rhythm", text: "While Battle Hymn lasts, your weapon attacks have a mortal limit 1 higher, up to 5." },
                    { level: 10, name: "Saga of Heroes", text: "Once per combat, an ally who can hear you drops to 1 hit point instead of 0." }
                ]
            },
            keeperOfLore: {
                name: "Keeper of Lore",
                features: [
                    { level: 2, name: "Well of Stories", text: "Mundane Reveal actions have a mortal limit 1 higher, up to 5. Once per long rest, ask the DM two questions about a creature, place or object." },
                    { level: 5, name: "Know Your Foe", text: "When your Reveal succeeds against a creature, learn a weakness. Its Guard DC is 1 lower for you and allies who heard you, until the end of the combat." },
                    { level: 10, name: "Legendary Tale", text: "Once per long rest, as a bonus action during your pre-turn, tell an ally's tale. Their next spell before the end of your next turn is 2 levels higher, up to their rank." }
                ]
            },
            siren: {
                name: "Siren",
                features: [
                    { level: 2, name: "Enchanting Voice", text: "Enemies must roll higher than level + 3 to break free of your Control spells." },
                    { level: 5, name: "Siren Song", text: "Instead of a Battle Hymn, enemies who hear you roll one die fewer." },
                    { level: 10, name: "Voice of Command", text: "Once per long rest, a Control spell affects every enemy who can hear you." }
                ]
            }
        },

        feats: [
            { key: "healingHymn", name: "Healing Hymn", text: "Your Aid spells heal 1 extra hit point per effect die, so shared dice share the bonus too." },
            { key: "mockingVerse", name: "Mocking Verse", text: "When your Control succeeds, the target rolls one die fewer next time." },
            { key: "wordBank", name: "Word Bank", minLevel: 4, text: "Shared Verse lets you give up to 6 tiles." },
            { key: "chorusLine", name: "Chorus Line", minLevel: 4, text: "Use Inspiring Word twice per round." },
            { key: "encore", name: "Encore", minLevel: 8, text: "Use Countersong twice per combat." }
        ]
    },

    runesmith: {
        name: "Runesmith",
        role: "Crafter",
        hitDie: 8,
        fixedHP: 5,
        gear: "Light armor. Light and simple weapons.",
        bonusRanks: "2 to Create, 1 to Change.",
        rankBonus: { create: 2, change: 1 },
        armor: 1,
        weapons: [4, 6],

        signature: {
            name: "Glyphs",
            glyphs: true,
            text: "Leave a written spell on a surface as a glyph, with a trigger. It fades after a day if not triggered. Its concealment level is its spell level. This is how many you can have at once."
        },

        features: [
            { level: 1, name: "Handy", text: "Mundane Change and Create actions have a mortal limit of 4." },
            { level: 1, name: "Written Word", text: "Write spells instead of speaking them (needs a free hand). Silent unless the DM decides otherwise; either way it can't be countered and works while silenced. Takes effect at the end of the round, and fails if you're downed first." },
            { level: 1, name: "Inscribe", text: "During a short or long rest, store a spell (up to level 2) in an object as a rune. Whoever holds it can release it as a bonus action." },
            { level: 1, name: "Tinker's Eye", text: "Things you make with Create are one quality step better, though not bigger." },
            { level: 3, name: "Construct", text: "During a long rest, build a construct out of scrap, no bigger than a person: 10 + 3 HP per level, 1 armor. It acts right after you and attacks with rank 2 and a d6. Commands take no action." },
            { level: 6, name: "Deep Runes", text: "Runes hold spells up to level 4. Your construct attacks with rank 3 and a d8." },
            { level: 9, name: "Masterwork", text: "Once per long rest, a creation gains a lasting property from a school at rank 3+. 3 such items at once." },
            { level: 12, name: "Grand Engine", text: "Runes hold spells up to your rank. Once per long rest, release all your runes or trigger all your glyphs on one casting turn." }
        ],

        subclasses: {
            glyphwarden: {
                name: "Glyphwarden",
                extraGlyphs: 1,
                features: [
                    { level: 2, name: "Lasting Glyphs", text: "1 more glyph at once, and glyphs last a week." },
                    { level: 5, name: "Chain Glyphs", text: "When a glyph triggers, trigger another of yours within 30 feet." },
                    { level: 10, name: "Warding Circle", text: "Once per long rest, draw a 30 ft circle: for an hour, enemy spells in or into it are 1 level lower, and you can have 3 extra glyphs in it. Its concealment level is your Change rank." }
                ]
            },
            alchemist: {
                name: "Alchemist",
                features: [
                    { level: 2, name: "Bottled Words", text: "During a long rest, roll Change and spell up to your Change rank in words, each a level 1 potion. Bonus action: drink it (works on you for 10 minutes) or throw it 30 ft (bursts, full effect within 5 ft)." },
                    { level: 5, name: "Volatile Mixtures", text: "Bonus action: combine two potions into one level 2 effect. Clashing words explode on a 1–2 on a d6, for 1d6 per level." },
                    { level: 10, name: "Master Brewer", text: "Potions are level 2, mixtures level 3, and you can mix three. Thrown potions burst across 15 ft. Once per long rest, a potion holds your Change rank." }
                ]
            },
            golemwright: {
                name: "Golemwright",
                features: [
                    { level: 2, name: "Early Apprentice", text: "Gain your Construct at level 2. It can take mundane actions with rank 2." },
                    { level: 5, name: "Rune Core", text: "Store one of your runes in your construct; it can release it." },
                    { level: 10, name: "Colossus", text: "Once per long rest, your construct grows huge for 3 rounds: twice the hit points, weapon die one size bigger, and its attacks also hit one target next to it." }
                ]
            }
        },

        feats: [
            { key: "quickInscribe", name: "Quick Inscribe", text: "In combat, store a spell you just spelled as a rune." },
            { key: "improvisedTools", name: "Improvised Tools", text: "Mundane Change and Create need no proper tools and take half the time." },
            { key: "runeAmmunition", name: "Rune Ammunition", minLevel: 4, text: "A rune on a weapon is released for free when your attack hits." },
            { key: "deepCarving", name: "Deep Carving", minLevel: 4, text: "Your runes and glyphs can each be used twice before they fade." },
            { key: "reinforcedConstruct", name: "Reinforced Construct", minLevel: 4, text: "Your construct has 2 more hit points per level, and 2 armor." },
            { key: "livingWorkshop", name: "Living Workshop", minLevel: 8, text: "2 more runes, and runes recharge after a long rest." }
        ]
    },

    trickster: {
        name: "Trickster",
        role: "Skirmisher",
        hitDie: 8,
        fixedHP: 5,
        gear: "Light armor. Light, simple and martial weapons.",
        bonusRanks: "1 to Harm, 1 to Change, 1 to Reveal.",
        rankBonus: { harm: 1, change: 1, reveal: 1 },
        armor: 1,
        weapons: [4, 6, 8],

        signature: {
            name: "Thrown Voice",
            rounds: 3,
            text: "Bonus action during your pre-turn. Lasts 3 rounds. Your spells sound like they come from any point you can see; enemies can only counter them if they see you. Ambush works on any target."
        },

        features: [
            { level: 1, name: "Sleight", text: "Once per round, at the start of your casting turn, take a random tile from any creature you can see that still holds tiles, and give it one of yours." },
            { level: 1, name: "Ambush", text: "Once per round, extra damage against a target that's unaware of you, distracted, or has one of your allies next to it: 2d6 (3d6 at 6, 4d6 at 9)." },
            { level: 1, name: "Expert", text: "Two schools of your choice have a mortal limit of 4 (5 at level 6). Pick them in Character settings." },
            { level: 3, name: "Slippery", text: "Half damage from area spells. Enemies can't make opportunity attacks against you." },
            { level: 6, name: "Twist the Word", text: "Once per combat, swap one of an enemy's revealed tiles for a random one. It uses the new tiles, bends the rules, or drops to level 1." },
            { level: 9, name: "Vanish", text: "Once per combat, as a bonus action, disappear until you attack, cast a spoken spell, or make a loud noise. Ambush rolls twice as many dice meanwhile." },
            { level: 12, name: "Perfect Heist", text: "Once per long rest, save an enemy's spell in a Tongue you know into an empty spell slot, at its level, up to your rank." }
        ],

        subclasses: {
            shadow: {
                name: "Shadow",
                features: [
                    { level: 2, name: "Silent Step", text: "Mundane Move for sneaking has a mortal limit 1 higher. Whispered spells don't give you away." },
                    { level: 5, name: "Assassinate", text: "In the first round of combat, Ambush deals its highest possible damage." },
                    { level: 10, name: "Death Mark", text: "Once per combat, mark a creature: your Ambush dice against it are doubled." }
                ]
            },
            mimic: {
                name: "Mimic",
                features: [
                    { level: 2, name: "Perfect Mimicry", text: "Imitate any voice. Spells cast in someone's voice seem to be theirs, unless you use a Tongue they don't know." },
                    { level: 5, name: "Copycat", text: "Once per combat, cast an enemy's revealed spell in a Tongue you know next turn, rolling its school." },
                    { level: 10, name: "Thousand Faces", text: "While Thrown Voice lasts, look like any humanoid you've seen. One extra use of Thrown Voice." }
                ]
            },
            gambler: {
                name: "Gambler",
                features: [
                    { level: 2, name: "Loaded Dice", text: "Once per round, reroll one die of your casting pool." },
                    { level: 5, name: "Double or Nothing", text: "Before rolling: on success, 1 level higher; on failure, two dice fewer next time." },
                    { level: 10, name: "House Always Wins", text: "Once per combat, replace one die of an enemy's roll with your own roll." }
                ]
            }
        },

        feats: [
            { key: "lightFingers", name: "Light Fingers", text: "Sleight takes 2 tiles." },
            { key: "silverLies", name: "Silver Lies", text: "A successful mundane Control in combat makes the target distracted for Ambush." },
            { key: "dirtyFighting", name: "Dirty Fighting", minLevel: 4, text: "When your weapon hits, roll a d6. On 5–6, trip, blind or disarm. Tripped or blinded: one die fewer next time. Disarmed: no attacks with that weapon until it's picked back up." },
            { key: "uncannyDodge", name: "Uncanny Dodge", minLevel: 4, text: "Once per round, halve the damage from one hit." },
            { key: "masterThief", name: "Master Thief", minLevel: 8, text: "Use Twist the Word twice per combat." }
        ]
    },

    spellblade: {
        name: "Spellblade",
        role: "Warrior-mage",
        hitDie: 10,
        fixedHP: 6,
        gear: "Light and medium armor. All weapons.",
        bonusRanks: "2 to Harm, 1 to Move.",
        rankBonus: { harm: 2, move: 1 },
        armor: 2,
        weapons: [4, 6, 8, 10],

        signature: {
            name: "Spellfury",
            untilCombatEnds: true,
            text: "Bonus action during your pre-turn. Weapon attacks deal one extra weapon die, and you take half damage from spells. Lasts until the end of the combat; ends if you're downed, or after a round in which you neither hit with a weapon nor took damage."
        },

        features: [
            { level: 1, name: "Weapon Training", text: "Weapon attacks have a mortal limit of 4." },
            { level: 1, name: "Bladeword", text: "On a weapon attack, draw tiles equal to your highest die. If it hits, spell a word of up to 4 letters for a level 1 effect from a school at rank 2+." },
            { level: 3, name: "Parry", text: "Once per round, when hit, reduce the damage by a roll of your weapon die. With a shield, roll it twice and add them." },
            { level: 6, name: "Weapon Mastery", text: "Weapon die one size bigger, mortal limit 5. Bladewords up to 5 letters at level 2." },
            { level: 9, name: "Cleave", text: "When your attack drops an enemy, deal half its damage to another enemy next to you." },
            { level: 12, name: "Spellstorm", text: "Bladewords have no letter limit and take effect at your attack's level." }
        ],

        subclasses: {
            heartblade: {
                name: "Heartblade",
                features: [
                    { level: 2, name: "Passion Weapon", text: "Once per round, when your attack hits, add 1d6 Passion damage, or heal an ally next to you for 1d6." },
                    { level: 5, name: "Heartfelt Bladewords", text: "Bladewords tied to your passion take effect 1 level higher." },
                    { level: 10, name: "Passion Unleashed", text: "While Spellfury lasts, roll Passion for weapon attacks instead of Harm. The weapon mortal limit still applies." }
                ]
            },
            arcaneArcher: {
                name: "Arcane Archer",
                features: [
                    { level: 2, name: "Enchanted Arrows", text: "Ranged weapon attacks reach twice as far and ignore cover, and your ranged weapon die is one size bigger." },
                    { level: 5, name: "Volley", text: "Once per round, a ranged attack targets two creatures, rolling damage separately. The Bladeword only affects the first target hit." },
                    { level: 10, name: "Sky-Piercer", text: "Once per combat, a ranged attack hits every creature in a 120 ft line, and its Bladeword affects all of them." }
                ]
            },
            spellguard: {
                name: "Spellguard",
                features: [
                    { level: 2, name: "Spell Parry", text: "Gain Parry at level 2; it also reduces spell damage." },
                    { level: 5, name: "Absorb", text: "When Parry stops a spell completely, draw tiles equal to the damage prevented." },
                    { level: 10, name: "Reflect", text: "Once per combat, roll Harm against a spell targeting only you. Enough surges sends it back." }
                ]
            }
        },

        feats: [
            { key: "duelist", name: "Duelist", text: "+1 armor while you fight with a single one-handed weapon and nothing in your other hand." },
            { key: "chargedBlade", name: "Charged Blade", text: "Your Bladewords can have one more letter." },
            { key: "arcaneRiposte", name: "Arcane Riposte", minLevel: 4, text: "When Parry reduces a hit to 0, make a level 1 weapon attack against the attacker." },
            { key: "eldritchReach", name: "Eldritch Reach", minLevel: 4, text: "Melee weapon attacks can hit a target up to 15 feet away." },
            { key: "battleCaster", name: "Battle Caster", minLevel: 8, text: "Once per combat, a weapon attack and a saved spell in the same pre-turn." }
        ]
    },

    warden: {
        name: "Warden",
        role: "Protector",
        hitDie: 12,
        fixedHP: 7,
        gear: "All armor and shields. All weapons.",
        bonusRanks: "2 to Aid, 1 to Harm.",
        rankBonus: { aid: 2, harm: 1 },
        armor: 3,
        shield: true,
        weapons: [4, 6, 8, 10],

        signature: {
            name: "Hold the Line",
            rounds: 3,
            text: "Bonus action during your pre-turn. Lasts 3 rounds. At the start of each round, every ally next to you gains 2 ward points. Enemies roll one die fewer when they target anyone but you."
        },

        features: [
            { level: 1, name: "Bulwark", text: "Weapon attacks and mundane Aid have a mortal limit of 4." },
            { level: 1, name: "Interpose", text: "Once per round, take the hit for an ally next to you. Your armor applies." },
            { level: 3, name: "Steadfast", text: "Once per long rest, drop to 1 hit point instead of 0." },
            { level: 6, name: "Aegis", text: "Anyone you protect with Aid also gains ward points equal to your armor, until your next turn. Mundane Aid mortal limit 5." },
            { level: 9, name: "Immovable", text: "Change, Move and Control effects below your Aid rank don't affect you." },
            { level: 12, name: "Last Bastion", text: "Once per long rest, for one round, every hit against an ally within 10 ft hits you instead, halved (rounded down), then your armor applies." }
        ],

        subclasses: {
            sentinel: {
                name: "Sentinel",
                features: [
                    { level: 2, name: "Hold Fast", text: "A creature you hit can't move away unless it beats the attack's level + 2 on its resist die." },
                    { level: 5, name: "Opportunist", text: "Once per round, attack an enemy next to you that attacks someone else (level 1)." },
                    { level: 10, name: "Wall of Iron", text: "While Hold the Line lasts, enemies can't move past you." }
                ]
            },
            lifewarden: {
                name: "Lifewarden",
                features: [
                    { level: 2, name: "Healing Hands", text: "Bonus action: level 1 first aid to an ally next to you. Aid spells heal 1 extra hit point per effect die." },
                    { level: 5, name: "Shared Strength", text: "When you heal an ally with Aid, heal half as much yourself." },
                    { level: 10, name: "Second Chance", text: "Once per long rest, bring back a creature that died in the last minute with 1 HP." }
                ]
            },
            oathkeeper: {
                name: "Oathkeeper",
                features: [
                    { level: 2, name: "Vow", text: "Once per combat, mark an enemy: your attacks and Harm spells against it deal an extra 1d6." },
                    { level: 5, name: "Retribution", text: "When an enemy hits an ally next to you, make it your Vow target. Next attack is 1 level higher." },
                    { level: 10, name: "Unbroken Oath", text: "While your Vow target lives, you drop to 1 instead of 0 the first time." }
                ]
            }
        },

        feats: [
            { key: "shieldBash", name: "Shield Bash", text: "When you Interpose, also make a level 1 weapon attack against the attacker." },
            { key: "fieldMedic", name: "Field Medic", text: "First aid reaches allies within 15 feet and heals with d6s." },
            { key: "taunt", name: "Taunt", minLevel: 4, text: "A successful mundane Control forces the target to attack you next turn, unless it beats the level + 2 on its resist die." },
            { key: "ironHide", name: "Iron Hide", minLevel: 4, text: "+1 armor." },
            { key: "guardianAngel", name: "Guardian Angel", minLevel: 8, text: "Interpose twice per round, for any ally you can reach." }
        ]
    }
};

/*
 * =========================================================
 * GENERAL FEATS
 * =========================================================
 *
 * repeatable: can be taken several times (counted, not just ticked)
 */

export const GENERAL_FEATS = [
    { group: "Body and mind", key: "alert", name: "Alert", text: "+5 to initiative. You can't be caught unaware, so Ambush only works on you if you're distracted or next to one of the Trickster's allies." },
    { group: "Body and mind", key: "lucky", name: "Lucky", text: "Once per long rest, reroll your whole casting pool." },
    { group: "Body and mind", key: "martialTraining", name: "Martial Training", text: "Martial weapons and medium armor." },
    { group: "Body and mind", key: "shieldAdept", name: "Shield Adept", text: "You can use shields." },
    { group: "Body and mind", key: "tough", name: "Tough", repeatable: 2, text: "+2 maximum hit points per level." },
    { group: "Body and mind", key: "steadyMind", name: "Steady Mind", minLevel: 4, text: "Add one die to saving throws." },

    { group: "Skill", key: "trained", name: "Trained", repeatable: 99, text: "A school's mundane mortal limit is 1 higher, up to 5. Pick the school below." },
    { group: "Skill", key: "persuasive", name: "Persuasive", text: "Add one die to mundane Control actions." },
    { group: "Skill", key: "keenSenses", name: "Keen Senses", text: "Add one die to mundane Reveal actions." },
    { group: "Skill", key: "medic", name: "Medic", text: "Short rests heal you and resting allies extra equal to your level. First aid cures poison and disease." },

    { group: "Spellcraft", key: "extraSlot", name: "Extra Slot", repeatable: 99, text: "One extra spell slot." },
    { group: "Spellcraft", key: "polyglot", name: "Polyglot", repeatable: 99, text: "Learn another Tongue, and gain its perk. Pick it in Character settings." },
    { group: "Spellcraft", key: "signatureSpell", name: "Signature Spell", minLevel: 4, text: "Once per combat, cast a chosen saved spell without rolling." },
    { group: "Spellcraft", key: "spellFocusHarm", name: "Spell Focus (Harm)", minLevel: 4, text: "Harm spells roll effect dice one size bigger." },
    { group: "Spellcraft", key: "spellFocusAid", name: "Spell Focus (Aid)", minLevel: 4, text: "Aid spells roll effect dice one size bigger." },
    { group: "Spellcraft", key: "spellFocusPassion", name: "Spell Focus (Passion)", minLevel: 4, text: "Passion spells roll effect dice one size bigger." },
    { group: "Spellcraft", key: "twinSpell", name: "Twin Spell", minLevel: 8, text: "Once per combat, a single-target spell targets a second creature, rolling the same effect dice for each." },
    { group: "Spellcraft", key: "reserveOfPower", name: "Reserve of Power", minLevel: 8, text: "Once per combat, a second pre-turn and casting turn right after your first." },

    { group: "Tile", key: "cantrips", name: "Cantrips", text: "Bonus action: spell a word of 3 letters or fewer with leftover tiles, at level 1 (not Harm or Passion)." },
    { group: "Tile", key: "letterHoard", name: "Letter Hoard", text: "Keep up to 3 unused tiles at the end of every casting turn." },
    { group: "Tile", key: "wildLetters", name: "Wild Letters", minLevel: 4, text: "Once per combat, roll a d6 and replace that many tiles with blanks." },

    { group: "Voice", key: "boomingVoice", name: "Booming Voice", text: "Shouting a spell deafens enemies within 10 feet." },
    { group: "Voice", key: "carryingVoice", name: "Carrying Voice", text: "Obstacles and noise never make you quieter for creatures you choose." },
    { group: "Voice", key: "softSpoken", name: "Soft-Spoken", text: "Whispered spells reach 30 feet, but are still only heard within 5." },
    { group: "Voice", key: "lipReader", name: "Lip Reader", text: "Counter spells of creatures you can see, even if you can't hear them, if you know the spell's Tongue." },
    { group: "Voice", key: "commandingVoice", name: "Commanding Voice", minLevel: 4, text: "A shouted Control spell affects one extra creature." },
    { group: "Voice", key: "silentCasting", name: "Silent Casting", minLevel: 8, text: "Once per combat, mouth a spell: no sound, 1 level lower. Only a Lip Reader who can see you and knows its Tongue can counter it." }
];

/* Every feat the class can pick, keyed by feat key. */
export function featsFor(className) {
    const classFeats = (CLASSES[className]?.feats ?? [])
        .map(feat => ({ ...feat, group: `${CLASSES[className].name}` }));

    return [...classFeats, ...GENERAL_FEATS];
}
