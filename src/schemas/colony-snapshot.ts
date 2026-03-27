import { z } from "zod";

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
  colonyNectar: z.number(),
  happinessPct: z.number(),
  broodOccupied: z.number(),
  broodTotal: z.number(),
  activeLevel: z.number(),
  wax: z.number(),
  transitionOverlay: z.number(),
  pendingCellTypeKey: z.string().nullable(),
  currentColonyDay: z.number(),
  currentColonySeason: seasonSchema,
  yearNumber: z.number(),
  isYearReviewOpen: z.boolean(),
  yearlyReviewStats: yearlyReviewStatsSchema,
});

export type ColonyUiSnapshotZ = z.infer<typeof colonyUiSnapshotSchema>;
