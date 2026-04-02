/**
 * Interactive first-play tutorial: one entry per step (new game only).
 */
export const TUTORIAL_STEP_COUNT = 12;

export const tutorialStepBodyHtml: readonly string[] = [
  "<strong>Welcome to Bee Happy!</strong> Your bee colony lives inside the hive. <strong>Grow comb</strong>, collect food, and keep your bees <strong>fed and happy</strong>. <strong>Stock honey</strong>—you will need it when winter ends foraging.",
  "Bees <strong>work jobs</strong> automatically: building, feeding larvae, gathering, and processing nectar into honey. <strong>You</strong> choose <strong>where</strong> to expand and <strong>what</strong> each cell is for.",
  "<strong>Build:</strong> use the <strong>Build</strong> bar at the bottom to pick <strong>brood</strong>, <strong>pollen</strong>, or <strong>nectar</strong>, then tap an <strong>empty hex</strong> next to built comb to start that cell type.",
  "<strong>Wait for construction:</strong> stay on this floor and let workers finish; the cell becomes <strong>built</strong> with the type you chose.",
  "<strong>Brood:</strong> with <strong>Brood</strong> selected on the bar, tap empty hexes to add brood comb. The queen lays eggs in brood cells, which hatch into larvae.",
  "<strong>Pollen:</strong> select <strong>Pollen</strong> on the bar, then tap to place. Workers forage for pollen to fill this cell and feed larvae.",
  "<strong>Nectar / honey:</strong> select <strong>Nectar</strong> on the bar, then tap to place. Bees drink nectar; nectar can be processed into <strong>honey</strong>, which stores through winter. To <strong>change an existing cell's type</strong>, tap the built cell and pick a new type in the menu.",
  "<strong>Move the view:</strong> <strong>drag</strong> on the hive (not a tiny tap). The camera pans so you can reach every hex.",
  "<strong>Levels:</strong> the hive has <strong>multiple floors</strong>. Use the <strong>Level</strong> strip on the right—<strong>drag up/down</strong> or tap a floor—to switch the active level.",
  "<strong>Keep the loop going:</strong> the queen uses <strong>brood</strong> cells; workers <strong>feed</strong> larvae and <strong>gather</strong>; <strong>happiness</strong> drops if bees go hungry or thirsty. Watch the HUD and seasons.",
  "<strong>Winter planning:</strong> before cold seasons, aim to <strong>process nectar into honey</strong> and <strong>store enough</strong>—when the world is lean, <strong>honey</strong> is what carries you.",
  "<strong>You are set.</strong> Use <strong>Settings</strong> (gear) to save, restart, or leave.",
];
