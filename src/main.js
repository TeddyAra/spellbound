import { loadState, commit } from "./state.js";
import "./character.js";
import "./casting.js";
import "./spellSlots.js";
import "./signature.js";
import "./construct.js";
import "./saves.js";
import "./reference.js";
import "./features.js";
import "./inventory.js";
import "./weapons.js";
import "./notes.js";
import "./dicePanel.js";
import "./diceSettings.js";
import "./tiles.js";
import "./tileView.js";
import "./overlays.js";
import "./reminders.js";
import "./settings.js";
import "./undo.js";
import "./log.js";
import "./characters.js";
import "./menuFit.js";
import "./phone.js";
import "./pwa.js";

loadState();

// Draws every panel
commit();
