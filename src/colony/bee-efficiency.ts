import { COLONY } from "./constants";

export type BeeNeedsLike = {
  hunger: number;
  thirst: number;
};

/** Matches HUD happiness: unhappy if either need is above the happy band. */
export const beeIsHappy = (needs: BeeNeedsLike): boolean =>
  needs.hunger <= COLONY.happyHungerMax && needs.thirst <= COLONY.happyThirstMax;

/**
 * Work output multiplier for a bee based on needs (1.0 when happy, down to min at max hunger/thirst).
 */
export const workerEfficiencyMul = (needs: BeeNeedsLike): number => {
  if (beeIsHappy(needs)) {
    return 1;
  }
  const hungerStress =
    Math.max(0, needs.hunger - COLONY.happyHungerMax) / (100 - COLONY.happyHungerMax);
  const thirstStress =
    Math.max(0, needs.thirst - COLONY.happyThirstMax) / (100 - COLONY.happyThirstMax);
  const stress = Math.max(hungerStress, thirstStress);
  return 1 - stress * (1 - COLONY.workerMinEfficiencyMul);
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
