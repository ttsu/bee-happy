import { BeeNeedsComponent } from "./ecs/components/colony-components";
import type { ColonyRuntime } from "./colony-runtime";
import { beeIsHappy } from "./bee-efficiency";

/**
 * Colony-wide happiness percentage (0–100) from bees with needs components.
 */
export const computeHappinessPct = (colony: ColonyRuntime): number => {
  let happy = 0;
  let totalNeeds = 0;
  for (const actor of colony.scene.actors) {
    const needs = actor.get(BeeNeedsComponent);
    if (!needs) {
      continue;
    }
    totalNeeds += 1;
    if (beeIsHappy(needs)) {
      happy += 1;
    }
  }
  if (totalNeeds === 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round((happy / totalNeeds) * 100)));
};
