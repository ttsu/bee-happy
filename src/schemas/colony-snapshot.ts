import { z } from "zod";

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
  debugTouch: z.string(),
});

export type ColonyUiSnapshotZ = z.infer<typeof colonyUiSnapshotSchema>;
