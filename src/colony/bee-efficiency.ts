import { COLONY } from "./constants";

export type BeeNeedsLike = {
  hunger: number;
};

/** Matches HUD happiness: unhappy if hunger is above the happy band. */
export const beeIsHappy = (needs: BeeNeedsLike): boolean =>
  needs.hunger <= COLONY.happyHungerMax;

/**
 * Work output multiplier for a bee based on hunger (1.0 when happy, down to min at max hunger).
 */
export const workerEfficiencyMul = (needs: BeeNeedsLike): number => {
  if (beeIsHappy(needs)) {
    return 1;
  }
  const hungerStress =
    Math.max(0, needs.hunger - COLONY.happyHungerMax) / (100 - COLONY.happyHungerMax);
  return 1 - hungerStress * (1 - COLONY.workerMinEfficiencyMul);
};

/** Scales timed work progress by the assigned bee's happiness-driven efficiency. */
export const scaledWorkElapsed = (
  elapsedMs: number,
  needs: BeeNeedsLike | undefined,
): number => {
  if (!needs) {
    return elapsedMs;
  }
  return elapsedMs * workerEfficiencyMul(needs);
};
