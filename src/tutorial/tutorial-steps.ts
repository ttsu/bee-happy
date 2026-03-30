/**
 * Interactive first-play tutorial: one entry per step (new game only).
 */
export const TUTORIAL_STEP_COUNT = 12;

export const tutorialStepBodyHtml: readonly string[] = [
  "<strong>Welcome to Bee Happy!</strong> Your bee colony lives inside the hive. <strong>Grow comb</strong>, collect food, and keep your bees <strong>fed and happy</strong>. <strong>Stock honey</strong>—you will need it when winter ends foraging.",
  "Bees <strong>work jobs</strong> automatically: building, feeding larvae, gathering, and processing nectar into honey. <strong>You</strong> choose <strong>where</strong> to expand and <strong>what</strong> each cell is for.",
  "<strong>Build:</strong> tap an <strong>empty hex</strong> next to built comb to tell workers where to <strong>build</strong> a new cell.",
  "<strong>Wait for construction:</strong> stay on this floor and let workers finish; the cell becomes <strong>built</strong> and empty.",
  "<strong>Make a brood cell:</strong> tap the <strong>new cell</strong>, then choose <strong>Brood</strong>. The queen lays eggs in brood cells, which hatch into larvae.",
  "<strong>Make a pollen cell:</strong> create a <strong>new cell</strong> and choose <strong>Pollen</strong>. Workers forage for pollen to fill this cell and feed larvae.",
  "<strong>Make a nectar cell:</strong> create a <strong>new cell</strong> and choose <strong>Nectar / honey</strong>. Bees drink nectar; nectar can be processed into <strong>honey</strong>, which stores through winter.",
  "<strong>Move the view:</strong> <strong>drag</strong> on the hive (not a tiny tap). The camera pans so you can reach every hex.",
  "<strong>Levels:</strong> the hive has <strong>multiple floors</strong>. Use the <strong>Level</strong> strip on the right—<strong>drag up/down</strong> or tap a floor—to switch the active level.",
  "<strong>Keep the loop going:</strong> the queen uses <strong>brood</strong> cells; workers <strong>feed</strong> larvae and <strong>gather</strong>; <strong>happiness</strong> drops if bees go hungry or thirsty. Watch the HUD and seasons.",
  "<strong>Winter planning:</strong> before cold seasons, aim to <strong>process nectar into honey</strong> and <strong>store enough</strong>—when the world is lean, <strong>honey</strong> is what carries you.",
  "<strong>You are set.</strong> Use <strong>Settings</strong> (gear) to save, restart, or leave.",
];
