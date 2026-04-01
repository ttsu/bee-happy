import { z } from "zod";

/** Why the player chose or was forced into succession (stored per lineage step). */
export const successionReasonSchema = z.enum([
  "hiveExpanded",
  "queenStarved",
  "queenAgedOut",
  "queenDiedOther",
]);

export type SuccessionReason = z.infer<typeof successionReasonSchema>;

export const rarityTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type RarityTier = z.infer<typeof rarityTierSchema>;

export const lineageEntrySchema = z.object({
  affixId: z.string(),
  displayName: z.string(),
  tier: rarityTierSchema,
  /** Effective bonus fraction, e.g. 0.08 = +8% primary axis */
  magnitude: z.number(),
  successionReason: successionReasonSchema,
  recordedAtIso: z.string(),
  /** 0-based succession generation */
  generationIndex: z.number().int().nonnegative(),
});

export type LineageEntry = z.infer<typeof lineageEntrySchema>;

export const lastSuccessionSummarySchema = z.object({
  endedAtIso: z.string(),
  colonyDay: z.number(),
  beesTotal: z.number(),
  honeyProducedThisRun: z.number(),
  successionReason: successionReasonSchema,
});

export type LastSuccessionSummary = z.infer<typeof lastSuccessionSummarySchema>;

export const metaProgressSchema = z.object({
  formatVersion: z.literal(1),
  lineage: z.array(lineageEntrySchema),
  lastSuccessionSummary: lastSuccessionSummarySchema.nullable().optional(),
});

export type MetaProgressV1 = z.infer<typeof metaProgressSchema>;

export const META_STORAGE_KEY = "bee-happy-meta-v1";

export const defaultMetaProgress = (): MetaProgressV1 => ({
  formatVersion: 1,
  lineage: [],
  lastSuccessionSummary: null,
});

export function parseMetaProgressJson(raw: string): MetaProgressV1 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return metaProgressSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function readMetaProgressFromStorage(): MetaProgressV1 {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) {
      return defaultMetaProgress();
    }
    const parsed = parseMetaProgressJson(raw);
    return parsed ?? defaultMetaProgress();
  } catch {
    return defaultMetaProgress();
  }
}

export function writeMetaProgressToStorage(data: MetaProgressV1): void {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(data));
}

export function appendLineageEntry(
  current: MetaProgressV1,
  entry: Omit<LineageEntry, "generationIndex"> & { generationIndex?: number },
): MetaProgressV1 {
  const generationIndex = entry.generationIndex ?? current.lineage.length;
  return {
    ...current,
    lineage: [...current.lineage, { ...entry, generationIndex }],
  };
}
