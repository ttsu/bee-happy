import type { Season } from "../seasons";

/** Tunables for build-demand meters (playtest knobs). */
export const DEMAND = {
  /** Fraction of adult feeds counted toward pollen build need. */
  adultPollenWeight: 0.25,
  /** Winter honey need weight for nectar build demand in Spring/Summer. */
  winterPlanWeightMild: 0.35,
  /** Winter honey need weight for nectar build demand in Fall/Winter. */
  winterPlanWeightPeak: 1,
  /** Need/capacity ratio where demand fill starts rising. */
  capacitySoftStart: 0.75,
  /** Stored/capacity ratio where storage-stress demand starts rising. */
  storageStressThreshold: 0.9,
} as const;

/** Constants slice required by {@link computeColonyDemand}. */
export type ColonyDemandConstants = {
  readonly workerLifespanMs: number;
  readonly hungerPerSec: number;
  readonly hungerRelief: number;
  readonly adultFeedHoneyCost: number;
  readonly adultFeedPollenCost: number;
  readonly larvaePollenUnitsNeeded: number;
  readonly larvaeNectarUnitsNeeded: number;
  readonly honeyNutrientMultiplier: number;
};

/** Inputs for SimCity-style cell build demand. */
export type ColonyDemandInput = {
  readonly beesTotal: number;
  readonly pollenStored: number;
  readonly pollenCapacity: number;
  readonly nectarStored: number;
  readonly honeyStored: number;
  readonly honeyCapacity: number;
  readonly broodTotal: number;
  /** Empty + cleaning brood cells (same grouping as HUD). */
  readonly broodEmpty: number;
  readonly eggCount: number;
  readonly larvaePollenBacklog: number;
  readonly larvaeNectarBacklog: number;
  readonly daysPerSeason: number;
  readonly season: Season;
  readonly constants: ColonyDemandConstants;
};

export type ColonyDemandResult = {
  /** 0–1 build urgency for pollen cells. */
  readonly demandPollen: number;
  /** 0–1 build urgency for nectar cells. */
  readonly demandNectar: number;
  /** 0–1 build urgency for brood cells. */
  readonly demandBrood: number;
  /** Honey stock needed to feed all bees for a full Winter. */
  readonly winterHoneyNeed: number;
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const msPerBeeDay = (workerLifespanMs: number): number => workerLifespanMs / 50;

const feedsPerBeeForSeconds = (
  seconds: number,
  hungerPerSec: number,
  hungerRelief: number,
): number => {
  if (hungerRelief <= 0) {
    return 0;
  }
  return (seconds * hungerPerSec) / hungerRelief;
};

const winterPlanWeight = (season: Season): number =>
  season === "Fall" || season === "Winter"
    ? DEMAND.winterPlanWeightPeak
    : DEMAND.winterPlanWeightMild;

const capacityDemand = (needed: number, capacity: number): number => {
  const soft = DEMAND.capacitySoftStart;
  const capacityFactor = needed / Math.max(1, capacity);
  return clamp01(Math.max(capacityFactor - soft, 0) / (1 - soft));
};

const storageStressDemand = (stored: number, capacity: number): number => {
  const threshold = DEMAND.storageStressThreshold;
  const stress = stored / Math.max(1, capacity);
  if (stress <= threshold) {
    return 0;
  }
  return clamp01((stress - threshold) / (1 - threshold));
};

/**
 * Honey units required to feed every bee through one full Winter at current metabolism.
 */
export const computeWinterHoneyNeed = (
  beesTotal: number,
  daysPerSeason: number,
  constants: ColonyDemandConstants,
): number => {
  const winterSec =
    Math.max(0, daysPerSeason) * (msPerBeeDay(constants.workerLifespanMs) / 1000);
  const feedsPerBee = feedsPerBeeForSeconds(
    winterSec,
    constants.hungerPerSec,
    constants.hungerRelief,
  );
  return Math.max(0, beesTotal) * feedsPerBee * constants.adultFeedHoneyCost;
};

/**
 * Computes pollen/nectar/brood build demand (0–1) and winter honey stock need.
 */
export const computeColonyDemand = (input: ColonyDemandInput): ColonyDemandResult => {
  const C = input.constants;
  const daySec = msPerBeeDay(C.workerLifespanMs) / 1000;
  const feedsPerBeeDay = feedsPerBeeForSeconds(daySec, C.hungerPerSec, C.hungerRelief);
  const bees = Math.max(0, input.beesTotal);
  const emptySlots = Math.max(0, input.broodEmpty);
  const eggs = Math.max(0, input.eggCount);

  const winterHoneyNeed = computeWinterHoneyNeed(bees, input.daysPerSeason, C);

  const neededPollen =
    Math.max(0, input.larvaePollenBacklog) +
    eggs * C.larvaePollenUnitsNeeded +
    emptySlots * C.larvaePollenUnitsNeeded +
    bees * feedsPerBeeDay * C.adultFeedPollenCost * DEMAND.adultPollenWeight;

  const neededNectarUnits =
    Math.max(0, input.larvaeNectarBacklog) +
    eggs * C.larvaeNectarUnitsNeeded +
    emptySlots * C.larvaeNectarUnitsNeeded +
    bees * feedsPerBeeDay * C.adultFeedHoneyCost +
    winterHoneyNeed * winterPlanWeight(input.season);

  const demandPollen = clamp01(
    Math.max(
      capacityDemand(neededPollen, input.pollenCapacity),
      storageStressDemand(input.pollenStored, input.pollenCapacity),
    ),
  );

  const nectarUtilStored =
    Math.max(0, input.nectarStored) + Math.max(0, input.honeyStored);
  const demandNectar = clamp01(
    Math.max(
      capacityDemand(neededNectarUnits, input.honeyCapacity),
      storageStressDemand(nectarUtilStored, input.honeyCapacity),
    ),
  );

  const broodSlots = Math.max(1, input.broodTotal);
  const fullBroodPollen = broodSlots * C.larvaePollenUnitsNeeded;
  const fullBroodNectar = broodSlots * C.larvaeNectarUnitsNeeded;
  const nectarEquivalent =
    Math.max(0, input.nectarStored) +
    Math.max(0, input.honeyStored) * C.honeyNutrientMultiplier;
  const canFeedFullBrood =
    input.pollenStored >= fullBroodPollen && nectarEquivalent >= fullBroodNectar;

  const emptyRatio = input.broodEmpty / Math.max(1, input.broodTotal);
  const slotPressure = clamp01(1 - emptyRatio);
  const demandBrood = canFeedFullBrood ? slotPressure : 0;

  return {
    demandPollen,
    demandNectar,
    demandBrood,
    winterHoneyNeed,
  };
};
