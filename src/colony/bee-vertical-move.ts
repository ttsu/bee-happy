import type { Actor } from "excalibur";
import { BeeLevelComponent } from "./ecs/components/colony-components";
import { COLONY } from "./constants";

/**
 * Runs an in-progress cross-hive-level transition. While this returns true, the bee should hold
 * position (typically at a junction or on a target) until the transition finishes.
 */
export const advanceBeeVerticalTransition = (
  actor: Actor,
  elapsed: number,
): boolean => {
  const lvl = actor.get(BeeLevelComponent);
  if (!lvl || lvl.verticalTransitionTargetLevel === null) {
    return false;
  }
  lvl.verticalTransitionElapsedMs += elapsed;
  if (lvl.verticalTransitionElapsedMs >= COLONY.beeLevelTransitionMs) {
    lvl.level = lvl.verticalTransitionTargetLevel;
    lvl.verticalTransitionTargetLevel = null;
    lvl.verticalTransitionElapsedMs = 0;
    return false;
  }
  return true;
};

/**
 * After reaching another actor's world position, begins a vertical move to match their hive level.
 */
export const startLevelTransitionTowardActorIfNeeded = (
  actor: Actor,
  target: Actor,
): void => {
  const lvl = actor.get(BeeLevelComponent);
  const targetLvl = target.get(BeeLevelComponent)?.level;
  if (!lvl || targetLvl == null || lvl.level === targetLvl) {
    return;
  }
  lvl.verticalTransitionTargetLevel = targetLvl;
  lvl.verticalTransitionElapsedMs = 0;
};
