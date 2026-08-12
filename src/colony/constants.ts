/** Tunable simulation constants for the Bee Happy prototype. */
export const COLONY = {
  hexSize: 36,
  /** Camera pan: movement below this (screen px) counts as tap, not drag. */
  panTapThresholdPx: 14,
  /**
   * Target seconds to finish one foundation with one builder in range.
   * More builders in range shorten wall-clock time proportionally.
   */
  cellBuildTargetSec: 5,
  /**
   * Max distance (world px) from cell center for level sync while moving to a build job.
   */
  buildReachPx: 120,
  /**
   * Worker must be within this distance of the cell center and at the end of the job path
   * before build progress applies.
   */
  buildWorkRadiusPx: 26,
  initialPollen: 12,
  /** Max beeswax stored per worker bee. */
  waxCapacityPerWorker: 4,
  /** Beeswax generated per second per worker bee. */
  waxRatePerWorkerPerSec: 0.28,
  /** Starting beeswax when a new colony is seeded. */
  initialBeeswax: 5,
  /** Total beeswax consumed to finish one foundation build. */
  cellBuildWaxCost: 5,
  /** Beeswax consumed when a cell type change is applied. */
  cellRetypeWaxCost: 2,
  /** Brood: time as egg (ms) before larvae. */
  eggDurationMs: 10_000,
  /** Pollen portions larvae must receive (each is one trip from a pollen cell). */
  larvaePollenUnitsNeeded: 4,
  /** Nectar/honey portions larvae must receive (each is one trip from a nectar cell). */
  larvaeNectarUnitsNeeded: 1,
  sealedDurationMs: 10_000,
  cleaningDurationMs: 5_000,
  /** Queen attempts to lay every N ms when brood cell is ready. */
  queenLayIntervalMs: 3_000,
  /** Queen must stay on the brood cell this long to complete laying. */
  queenLayDurationMs: 1_000,
  /** Hunger per second (0–100 scale). */
  hungerPerSec: 0.8,
  /** Bee is "happy" when hunger is at or below this value. */
  happyHungerMax: 50,
  /** Recovery per feeding. */
  hungerRelief: 50,
  /**
   * Threshold to open adult care jobs.
   *
   * Intentionally sits below {@link happyHungerMax} so bees start prioritizing
   * feeding before they are considered "unhappy" in the UI.
   */
  hungerCareThreshold: 30,
  /** Forage timings. */
  forageTravelMs: 2_000,
  forageWaitMs: 1_000,
  /** Max pollen units per pollen storage cell. */
  pollenCellCapacity: 12,
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
  /** Cell nectar units consumed per adult hunger feed (was 0.5 × scale). */
  adultFeedCellNectarCost: 2,
  /** Cell honey units consumed per adult hunger feed (was 0.1 × scale; 4× density vs cell nectar cost). */
  adultFeedHoneyCost: 1,
  /** Level transition (ms each phase). */
  levelFadeMs: 380,
  /** Zoom during level transition. */
  levelZoomPeak: 1.08,
  /** UI snapshot throttle (ms). */
  uiSnapshotMs: 120,
  /** Bee movement speed (world units per ms). */
  beeSpeed: 0.09,
  /**
   * Multiplier on forage legs only (pollen/nectar outbound, return, deposit path).
   * Other movement uses {@link beeSpeed} without this factor.
   */
  forageFlightSpeedMultiplier: 2.5,
  /**
   * Lower bound for {@link pathLegSpeedMultiplier} (0–1). Higher = less slowdown at leg ends.
   */
  pathLegEasingMinSpeedMultiplier: 0.22,
  /** Cross-hive-level move: wing-flap + zoom duration at the junction hex (ms). */
  beeLevelTransitionMs: 300,
  /** Peak extra scale during {@link beeLevelTransitionMs} (multiplier, e.g. 0.06 → up to 1.06×). */
  beeLevelTransitionZoomPeak: 0.06,
  /**
   * When choosing a self-feed cell across levels, added to horizontal distance per hive level
   * away from the bee (so nearer levels win ties at the same hex).
   */
  selfFeedCrossLevelPenaltyPx: 72,
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
  feedLarvaeCollectMs: 1_000,
  /** Time at the brood cell to deposit one load (ms). */
  feedLarvaeDepositMs: 1_000,
  /** Total adult worker lifespan in ms (50 bee-days). */
  workerLifespanMs: 240_000,
  /** Seeded workers start between these bee-days (forager-capable). */
  bootstrapWorkerAgeMinDays: 22,
  bootstrapWorkerAgeMaxDays: 40,
  /** Timed interaction for nurse feeding the queen. */
  feedQueenDurationMs: 1_400,
  /** Pollen storage units consumed per self-feed when using pollen cells. */
  adultFeedPollenCost: 2,
  /** Radius for self-feed and guard completion (world px). */
  selfFeedWorkRadiusPx: 28,
  /** Guard job: must stay near entrance this long (ms). */
  guardHiveDurationMs: 4_000,
  /** When foraging has no deposit capacity, re-check interval (ms). */
  forageCapacityPollIntervalMs: 500,
  /** Payload units applied when depositing after pollen forage. */
  foragePollenDepositAmount: 4,
  /** Payload units applied when depositing after nectar forage. */
  forageNectarDepositAmount: 4,
  /** `clearCellForRetype`: ms between relocation chunks at the cell. */
  retypeRelocateIntervalMs: 400,
  /** Max pollen units moved per relocation tick. */
  retypeRelocateChunkPollen: 2,
  /** Max nectar units moved per relocation tick. */
  retypeRelocateChunkNectar: 2,
  /** Max honey units moved per relocation tick. */
  retypeRelocateChunkHoney: 2,
  /**
   * Optional succession: player may start succession when total bees (workers + queen) exceed this.
   */
  successionOptionalBeeThreshold: 50,
  /**
   * When a calendar year ends, if the current calendar year number equals this value,
   * mandatory succession runs (queen aged out) instead of the normal year review.
   */
  queenAgeOutYearNumber: 3,
  /**
   * Royal jelly earned per colony day (fractional): `happinessPct * this / 100`.
   * Whole units are minted when the accrual buffer crosses integers.
   * At 80% happiness and 1 here → 0.8 jelly per day.
   */
  royalJellyPercentOfHappiness: 1,
  /** Minimum work output multiplier when a worker is fully unhappy (hunger at 100). */
  workerMinEfficiencyMul: 0.5,
} as const;
