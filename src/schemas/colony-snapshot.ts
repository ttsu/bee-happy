import { z } from "zod";

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
  cellTypeChangeError: z.string().nullable(),
  cellTypeChangeDiscardTarget: z.enum(["brood", "pollen", "nectar"]).nullable(),
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
