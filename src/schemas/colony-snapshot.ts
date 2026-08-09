import { z } from "zod";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { SEASON_LENGTH_DAYS } from "../colony/seasons";

const successionReasonSchema = z.enum([
  "hiveExpanded",
  "queenStarved",
  "queenAgedOut",
  "queenDiedOther",
]);

const seasonSchema = z.enum(["Spring", "Summer", "Fall", "Winter"]);

const yearlyReviewStatsSchema = z.object({
  honeyProcessedTotal: z.number(),
  nectarCollectedTotal: z.number(),
  pollenCollectedTotal: z.number(),
  beesHatchedTotal: z.number(),
  remainingBees: z.number(),
  happyBeeSecondsTotal: z.number(),
});

/** Zod schema for UI-facing colony snapshots (mirrors {@link ColonyUiSnapshot}). */
export const colonyUiSnapshotSchema = z.object({
  beesTotal: z.number(),
  workers: z.number(),
  queens: z.number(),
  pollen: z.number(),
  pollenCapacity: z.number(),
  honey: z.number(),
  honeyCapacity: z.number(),
  nectar: z.number(),
  nectarCapacity: z.number(),
  beeswax: z.number(),
  beeswaxCapacity: z.number(),
  happinessPct: z.number(),
  broodOccupied: z.number(),
  broodTotal: z.number(),
  broodPupae: z.number(),
  broodLarvae: z.number(),
  broodEmpty: z.number(),
  activeLevel: z.number(),
  transitionOverlay: z.number(),
  pendingCellTypeKey: z.string().nullable(),
  pendingCellTypeAnchor: z.object({ pageX: z.number(), pageY: z.number() }).nullable(),
  cellTypeChangeError: z.string().nullable(),
  cellTypeChangeDiscardTarget: z.enum(["brood", "pollen", "nectar"]).nullable(),
  selectedPlacementCellType: z.enum(["brood", "pollen", "nectar"]),
  currentColonyDay: z.number(),
  currentColonySeason: seasonSchema,
  daysPerSeason: z.number(),
  demandPollen: z.number(),
  demandNectar: z.number(),
  demandBrood: z.number(),
  winterHoneyNeed: z.number(),
  lineageSystemEnabled: z.boolean(),
  intrudersEnabled: z.boolean(),
  yearNumber: z.number(),
  isYearReviewOpen: z.boolean(),
  yearlyReviewStats: yearlyReviewStatsSchema,
  successionModal: z
    .object({
      mandatory: z.boolean(),
      reason: successionReasonSchema,
      honeyBudget: z.number(),
      beesTotal: z.number(),
      colonyDay: z.number(),
    })
    .nullable(),
  optionalSuccessionAvailable: z.boolean(),
  simulationSpeed: z.union([z.literal(1), z.literal(2)]),
});

export type ColonyUiSnapshotZ = z.infer<typeof colonyUiSnapshotSchema>;

/**
 * Initial HUD snapshot before the colony bridge is ready or when resetting local UI state.
 * Keep in sync with {@link colonyUiSnapshotSchema} and {@link ColonyUiSnapshot}.
 */
export const createDefaultColonyUiSnapshot = (): ColonyUiSnapshot => ({
  beesTotal: 0,
  workers: 0,
  queens: 0,
  pollen: 0,
  pollenCapacity: 0,
  honey: 0,
  honeyCapacity: 0,
  nectar: 0,
  nectarCapacity: 0,
  beeswax: 0,
  beeswaxCapacity: 0,
  happinessPct: 100,
  broodOccupied: 0,
  broodTotal: 0,
  broodPupae: 0,
  broodLarvae: 0,
  broodEmpty: 0,
  activeLevel: 0,
  transitionOverlay: 0,
  pendingCellTypeKey: null,
  pendingCellTypeAnchor: null,
  cellTypeChangeError: null,
  cellTypeChangeDiscardTarget: null,
  selectedPlacementCellType: "brood",
  currentColonyDay: 1,
  currentColonySeason: "Spring",
  daysPerSeason: SEASON_LENGTH_DAYS,
  demandPollen: 0,
  demandNectar: 0,
  demandBrood: 0,
  winterHoneyNeed: 0,
  lineageSystemEnabled: false,
  intrudersEnabled: false,
  yearNumber: 1,
  isYearReviewOpen: false,
  yearlyReviewStats: {
    honeyProcessedTotal: 0,
    nectarCollectedTotal: 0,
    pollenCollectedTotal: 0,
    beesHatchedTotal: 0,
    remainingBees: 0,
    happyBeeSecondsTotal: 0,
  },
  successionModal: null,
  optionalSuccessionAvailable: false,
  simulationSpeed: 1,
});
