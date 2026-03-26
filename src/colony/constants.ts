/** Tunable simulation constants for the Bee Happy prototype. */
export const COLONY = {
  hexSize: 36,
  /** Camera pan: movement below this (screen px) counts as tap, not drag. */
  panTapThresholdPx: 14,
  /** Build: wax consumed per second per worker in range. */
  waxPerBuilderPerSec: 0.12,
  /** Max distance (world px) a worker can contribute wax toward a build site. */
  buildReachPx: 120,
  /** Starting wax stock. */
  initialWax: 80,
  initialPollen: 40,
  initialHoney: 25,
  initialColonyNectar: 10,
  /** Brood: time as egg (ms) before larvae. */
  eggDurationMs: 12_000,
  /** Larvae must receive this much "food units" before sealing. */
  larvaeFoodNeeded: 8,
  /** Food delivered per feed job completion. */
  feedAmountPerVisit: 2,
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
  /** Nectar cell capacity before honey processing can start. */
  nectarCellCapacity: 12,
  honeyProcessRatePerSec: 0.08,
  /** Level transition (ms each phase). */
  levelFadeMs: 380,
  /** Zoom during level transition. */
  levelZoomPeak: 1.08,
  /** UI snapshot throttle (ms). */
  uiSnapshotMs: 120,
  /** Bee movement speed (world units per ms). */
  beeSpeed: 0.09,
  /** Pollen consumed per larvae feeding unit (from storage). */
  pollenPerFeedUnit: 1,
  /** Honey fallback per feed if no pollen for larvae (simplified). */
  honeyPerFeedUnit: 0.4,
} as const;
