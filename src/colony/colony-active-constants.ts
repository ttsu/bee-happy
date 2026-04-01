import {
  buildEffectiveColonyConstants,
  type EffectiveColonyConstants,
} from "./effective-colony";
import { aggregateLineageMultipliers } from "./meta/lineage-aggregate";
import { readMetaProgressFromStorage } from "./meta/meta-progress";

let cached: EffectiveColonyConstants = buildEffectiveColonyConstants(
  aggregateLineageMultipliers([]),
);

/**
 * Recomputes effective simulation constants from persisted lineage meta.
 * Call after colony init and whenever meta lineage changes in-session.
 */
export function refreshActiveColonyConstantsFromMeta(): void {
  const meta = readMetaProgressFromStorage();
  const m = aggregateLineageMultipliers(meta.lineage);
  cached = buildEffectiveColonyConstants(m);
}

export function getActiveColonyConstants(): EffectiveColonyConstants {
  return cached;
}
