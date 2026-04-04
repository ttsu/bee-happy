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
 *
 * @param applyLineageMultipliers - When false, lineage bonuses are ignored (sandbox / lineage-off saves).
 */
export function refreshActiveColonyConstantsFromMeta(
  applyLineageMultipliers = true,
): void {
  const meta = readMetaProgressFromStorage();
  const lineage = applyLineageMultipliers ? meta.lineage : [];
  const m = aggregateLineageMultipliers(lineage);
  cached = buildEffectiveColonyConstants(m);
}

export function getActiveColonyConstants(): EffectiveColonyConstants {
  return cached;
}
