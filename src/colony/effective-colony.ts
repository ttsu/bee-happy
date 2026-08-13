import { COLONY } from "./constants";
import type { LineageMultipliers } from "./meta/lineage-aggregate";

export type EffectiveColonyConstants = {
  readonly hexSize: number;
  readonly cellBuildTargetSec: number;
  readonly buildReachPx: number;
  readonly buildWorkRadiusPx: number;
  readonly initialPollen: number;
  readonly waxCapacityPerWorker: number;
  readonly waxRatePerWorkerPerSec: number;
  readonly initialBeeswax: number;
  readonly cellBuildWaxCost: number;
  readonly cellRetypeWaxCost: number;
  readonly eggDurationMs: number;
  readonly larvaePollenUnitsNeeded: number;
  readonly larvaeNectarUnitsNeeded: number;
  readonly sealedDurationMs: number;
  readonly cleaningDurationMs: number;
  readonly queenLayIntervalMs: number;
  readonly queenLayDurationMs: number;
  readonly hungerPerSec: number;
  readonly happyHungerMax: number;
  readonly hungerRelief: number;
  readonly hungerCareThreshold: number;
  readonly forageTravelMs: number;
  readonly forageWaitMs: number;
  readonly pollenCellCapacity: number;
  readonly nectarCellCapacity: number;
  readonly honeyCellCapacity: number;
  readonly honeyProcessRatePerSec: number;
  readonly honeyNutrientMultiplier: number;
  readonly larvaeFeedHoneyCost: number;
  readonly adultFeedCellNectarCost: number;
  readonly adultFeedHoneyCost: number;
  readonly levelFadeMs: number;
  readonly levelZoomPeak: number;
  readonly uiSnapshotMs: number;
  readonly beeSpeed: number;
  readonly forageFlightSpeedMultiplier: number;
  readonly pathLegEasingMinSpeedMultiplier: number;
  readonly beeLevelTransitionMs: number;
  readonly beeLevelTransitionZoomPeak: number;
  readonly selfFeedCrossLevelPenaltyPx: number;
  readonly idleWanderJitterPx: number;
  readonly idleWanderSpeedMultiplier: number;
  readonly idleWanderPauseMinMs: number;
  readonly idleWanderPauseMaxMs: number;
  readonly queenIdleWanderSpeedMultiplier: number;
  readonly queenIdleWanderJitterPx: number;
  readonly queenIdleWanderPauseMinMs: number;
  readonly queenIdleWanderPauseMaxMs: number;
  readonly queenIdlePreferEmptyBroodChance: number;
  readonly pollenPerFeedUnit: number;
  readonly feedLarvaeCollectMs: number;
  readonly feedLarvaeDepositMs: number;
  readonly workerLifespanMs: number;
  readonly bootstrapWorkerAgeMinDays: number;
  readonly bootstrapWorkerAgeMaxDays: number;
  readonly feedQueenDurationMs: number;
  readonly adultFeedPollenCost: number;
  readonly selfFeedWorkRadiusPx: number;
  readonly guardHiveDurationMs: number;
  readonly forageCapacityPollIntervalMs: number;
  readonly foragePollenDepositAmount: number;
  readonly forageNectarDepositAmount: number;
  readonly retypeRelocateIntervalMs: number;
  readonly retypeRelocateChunkPollen: number;
  readonly retypeRelocateChunkNectar: number;
  readonly retypeRelocateChunkHoney: number;
  readonly panTapThresholdPx: number;
  readonly royalJellyPercentOfHappiness: number;
  readonly workerMinEfficiencyMul: number;
};

const MIN_FOOD_CELL_CAPACITY = 4;

/**
 * Builds simulation constants with lineage multipliers applied (read-only snapshot).
 */
export function buildEffectiveColonyConstants(
  m: LineageMultipliers,
): EffectiveColonyConstants {
  const pollenCellCapacity = Math.max(
    MIN_FOOD_CELL_CAPACITY,
    COLONY.pollenCellCapacity +
      m.pollenCellCapacityFlat -
      m.tradeoffFoodCellCapacityFlat,
  );
  const nectarCellCapacity = Math.max(
    MIN_FOOD_CELL_CAPACITY,
    COLONY.nectarCellCapacity +
      m.nectarCellCapacityFlat -
      m.tradeoffNectarCapacityFlat -
      m.tradeoffFoodCellCapacityFlat,
  );
  const forageTimeMul = m.forageTimeMul * (1 + m.tradeoffForageTimeFrac);
  return {
    ...COLONY,
    pollenCellCapacity,
    nectarCellCapacity,
    honeyCellCapacity: nectarCellCapacity,
    forageTravelMs: COLONY.forageTravelMs * forageTimeMul,
    forageWaitMs: COLONY.forageWaitMs * forageTimeMul,
    eggDurationMs: COLONY.eggDurationMs * m.broodCycleMul,
    sealedDurationMs: COLONY.sealedDurationMs * m.broodCycleMul,
    cleaningDurationMs: COLONY.cleaningDurationMs * m.broodCycleMul,
    honeyProcessRatePerSec:
      COLONY.honeyProcessRatePerSec *
      m.honeyProcessRateMul *
      Math.max(0.5, 1 - m.tradeoffHoneyProcessFrac),
    foragePollenDepositAmount: Math.max(
      1,
      COLONY.foragePollenDepositAmount + m.foragePollenDepositFlat,
    ),
    forageNectarDepositAmount: Math.max(
      1,
      COLONY.forageNectarDepositAmount + m.forageNectarDepositFlat,
    ),
    hungerPerSec:
      COLONY.hungerPerSec * m.needsDrainMul * (1 + m.tradeoffNeedsDrainFrac),
    cellBuildTargetSec:
      COLONY.cellBuildTargetSec * m.cellBuildMul * (1 + m.tradeoffCellBuildFrac),
    queenLayIntervalMs:
      COLONY.queenLayIntervalMs *
      (2 - m.broodCycleMul) *
      (1 + m.tradeoffQueenLayIntervalFrac),
    beeSpeed: COLONY.beeSpeed * Math.max(0.5, 1 - m.tradeoffBeeSpeedFrac),
  };
}
