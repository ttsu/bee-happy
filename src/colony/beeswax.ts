import type { EffectiveColonyConstants } from "./effective-colony";

/** Max beeswax the hive can hold given the current worker count. */
export const beeswaxCapacity = (
  workers: number,
  C: Pick<EffectiveColonyConstants, "waxCapacityPerWorker">,
): number => workers * C.waxCapacityPerWorker;

/** Passive beeswax generation rate (units per second). */
export const beeswaxAccrualPerSec = (
  workers: number,
  C: Pick<EffectiveColonyConstants, "waxRatePerWorkerPerSec">,
): number => workers * C.waxRatePerWorkerPerSec;

/** Wax still needed to complete a foundation build from the current progress. */
export const remainingBuildWaxCost = (
  buildProgress: number,
  C: Pick<EffectiveColonyConstants, "cellBuildWaxCost">,
): number => C.cellBuildWaxCost * (1 - buildProgress);
