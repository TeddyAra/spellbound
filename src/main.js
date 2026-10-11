import { loadState, commit } from "./state.js";
import "./character.js";
import "./casting.js";
import "./spellSlots.js";
import "./signature.js";
import "./features.js";
import "./inventory.js";
import "./dicePanel.js";
import "./diceSettings.js";
import "./tiles.js";
import "./overlays.js";
import "./reminders.js";

loadState();

// Draws every panel
commit();
