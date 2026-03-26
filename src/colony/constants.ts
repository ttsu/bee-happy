/** Tunable simulation constants for the Bee Happy prototype. */
export const COLONY = {
  hexSize: 36,
  /** Camera pan: movement below this (screen px) counts as tap, not drag. */
  panTapThresholdPx: 14,
  /** Build: wax consumed per second per worker in range. */
  waxPerBuilderPerSec: 0.12,
  /**
   * Target seconds to finish one foundation with one builder (wax not limiting).
   * More builders in range shorten wall-clock time proportionally.
   */
  cellBuildTargetSec: 5,
  /**
   * Max distance (world px) from cell center for level sync while moving to a build job.
   */
  buildReachPx: 120,
  /**
   * Worker must be within this distance of the cell center and at the end of the job path
   * before wax/build progress applies.
   */
  buildWorkRadiusPx: 26,
  /** Starting wax stock. */
  initialWax: 80,
  initialPollen: 40,
  /** Colony nectar buffer (integer units; adult feed uses adultFeedColonyNectarCost). */
  initialColonyNectar: 100,
  /** Brood: time as egg (ms) before larvae. */
  eggDurationMs: 12_000,
  /** Pollen portions larvae must receive (each is one trip from a pollen cell). */
  larvaePollenUnitsNeeded: 4,
  /** Nectar/honey portions larvae must receive (each is one trip from a nectar cell). */
  larvaeNectarUnitsNeeded: 4,
  sealedDurationMs: 10_000,
  cleaningDurationMs: 6_000,
  /** Queen attempts to lay every N ms when brood cell is ready. */
  queenLayIntervalMs: 8_000,
  /** Hunger / thirst per second (0–100 scale). */
  hungerPerSec: 0.35,
  thirstPerSec: 0.45,
  /** Bee is "happy" when hunger and thirst are at or below these values. */
  happyHungerMax: 35,
  happyThirstMax: 35,
  /** Recovery per feeding/drink. */
  hungerRelief: 45,
  thirstRelief: 50,
  /** Threshold to open adult feeding job. */
  hungerCareThreshold: 55,
  thirstCareThreshold: 55,
  /** Forage timings. */
  forageTravelMs: 2_500,
  forageWaitMs: 1_800,
  waterForageMs: 2_000,
  /** Max pollen units per pollen storage cell. */
  pollenCellCapacity: 48,
  /** Nectar cell capacity before honey processing can start. */
  nectarCellCapacity: 12,
  /** Max honey units stored in a nectar cell after processing (same cell as nectar; mutually exclusive). */
  honeyCellCapacity: 12,
  honeyProcessRatePerSec: 0.08,
  /**
   * One larvae honey load consumes this many stored honey units and satisfies this many nectar portions.
   * (Honey is 4× as nutrient-dense as nectar for larvae.)
   */
  honeyNutrientMultiplier: 4,
  /** Honey units removed from a cell for one larvae honey delivery (satisfies honeyNutrientMultiplier nectar portions). */
  larvaeFeedHoneyCost: 1,
  /** Colony nectar units consumed per adult hunger feed (integer economy; was 0.4 × scale). */
  adultFeedColonyNectarCost: 4,
  /** Cell nectar units consumed per adult hunger feed (was 0.5 × scale). */
  adultFeedCellNectarCost: 5,
  /** Cell honey units consumed per adult hunger feed (was 0.1 × scale; 4× density vs colony nectar cost). */
  adultFeedHoneyCost: 1,
  /** Queue nectar forage when colony nectar buffer is below this (was 8 in pre-scale units). */
  colonyNectarForageThreshold: 80,
  /** Level transition (ms each phase). */
  levelFadeMs: 380,
  /** Zoom during level transition. */
  levelZoomPeak: 1.08,
  /** UI snapshot throttle (ms). */
  uiSnapshotMs: 120,
  /** Bee movement speed (world units per ms). */
  beeSpeed: 0.09,
  /** Random offset around a hex center for idle targets (world px). */
  idleWanderJitterPx: 10,
  /** Idle movement uses `beeSpeed *` this factor (slower than task movement). */
  idleWanderSpeedMultiplier: 0.48,
  /** Random pause duration after an idle bee reaches a wander point (ms). */
  idleWanderPauseMinMs: 280,
  idleWanderPauseMaxMs: 920,
  /** Queen idle: slower drift so she mostly inspects brood rather than touring the comb. */
  queenIdleWanderSpeedMultiplier: 0.22,
  queenIdleWanderJitterPx: 5,
  queenIdleWanderPauseMinMs: 1_600,
  queenIdleWanderPauseMaxMs: 4_800,
  /**
   * When choosing the next brood hex to visit, chance to pick an empty cell if any exist
   * (otherwise any built brood cell).
   */
  queenIdlePreferEmptyBroodChance: 0.85,
  /** Pollen consumed per larvae feeding unit (from storage). */
  pollenPerFeedUnit: 1,
  /** Time at the food cell to gather one load for larvae (ms). */
  feedLarvaeCollectMs: 2_800,
  /** Time at the brood cell to deposit one load (ms). */
  feedLarvaeDepositMs: 2_600,
} as const;
