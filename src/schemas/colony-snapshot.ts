import { z } from "zod";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";

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
  honey: z.number(),
  nectar: z.number(),
  happinessPct: z.number(),
  broodOccupied: z.number(),
  broodTotal: z.number(),
  activeLevel: z.number(),
  transitionOverlay: z.number(),
  pendingCellTypeKey: z.string().nullable(),
  pendingCellTypeAnchor: z.object({ pageX: z.number(), pageY: z.number() }).nullable(),
  cellTypeChangeError: z.string().nullable(),
  cellTypeChangeDiscardTarget: z.enum(["brood", "pollen", "nectar"]).nullable(),
  selectedPlacementCellType: z.enum(["brood", "pollen", "nectar"]),
  currentColonyDay: z.number(),
  currentColonySeason: seasonSchema,
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
  honey: 0,
  nectar: 0,
  happinessPct: 100,
  broodOccupied: 0,
  broodTotal: 0,
  activeLevel: 0,
  transitionOverlay: 0,
  pendingCellTypeKey: null,
  pendingCellTypeAnchor: null,
  cellTypeChangeError: null,
  cellTypeChangeDiscardTarget: null,
  selectedPlacementCellType: "brood",
  currentColonyDay: 1,
  currentColonySeason: "Spring",
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
});
