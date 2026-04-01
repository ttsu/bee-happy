import { COLONY } from "./constants";
import type { LineageMultipliers } from "./meta/lineage-aggregate";

export type EffectiveColonyConstants = {
  readonly hexSize: number;
  readonly cellBuildTargetSec: number;
  readonly buildReachPx: number;
  readonly buildWorkRadiusPx: number;
  readonly initialPollen: number;
  readonly eggDurationMs: number;
  readonly larvaePollenUnitsNeeded: number;
  readonly larvaeNectarUnitsNeeded: number;
  readonly sealedDurationMs: number;
  readonly cleaningDurationMs: number;
  readonly queenLayIntervalMs: number;
  readonly queenLayDurationMs: number;
  readonly hungerPerSec: number;
  readonly thirstPerSec: number;
  readonly happyHungerMax: number;
  readonly happyThirstMax: number;
  readonly hungerRelief: number;
  readonly thirstRelief: number;
  readonly hungerCareThreshold: number;
  readonly thirstCareThreshold: number;
  readonly forageTravelMs: number;
  readonly forageWaitMs: number;
  readonly waterForageMs: number;
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
  readonly successionOptionalBeeThreshold: number;
  readonly queenAgeOutYearNumber: number;
};

/**
 * Builds simulation constants with lineage multipliers applied (read-only snapshot).
 */
export function buildEffectiveColonyConstants(
  m: LineageMultipliers,
): EffectiveColonyConstants {
  return {
    ...COLONY,
    pollenCellCapacity: Math.round(COLONY.pollenCellCapacity * m.pollenCellCapacityMul),
    nectarCellCapacity: Math.round(COLONY.nectarCellCapacity * m.nectarCellCapacityMul),
    forageTravelMs: COLONY.forageTravelMs * m.forageTimeMul,
    forageWaitMs: COLONY.forageWaitMs * m.forageTimeMul,
    waterForageMs: COLONY.waterForageMs * m.forageTimeMul,
    eggDurationMs: COLONY.eggDurationMs * m.broodCycleMul,
    sealedDurationMs: COLONY.sealedDurationMs * m.broodCycleMul,
    cleaningDurationMs: COLONY.cleaningDurationMs * m.broodCycleMul,
    honeyProcessRatePerSec: COLONY.honeyProcessRatePerSec * m.honeyProcessRateMul,
    foragePollenDepositAmount: Math.max(
      1,
      Math.round(COLONY.foragePollenDepositAmount * m.depositYieldMul),
    ),
    forageNectarDepositAmount: Math.max(
      1,
      Math.round(COLONY.forageNectarDepositAmount * m.depositYieldMul),
    ),
    hungerPerSec: COLONY.hungerPerSec * m.needsDrainMul,
    thirstPerSec: COLONY.thirstPerSec * m.needsDrainMul,
    cellBuildTargetSec: COLONY.cellBuildTargetSec * m.cellBuildMul,
    queenLayIntervalMs: COLONY.queenLayIntervalMs * (2 - m.broodCycleMul),
  };
}
