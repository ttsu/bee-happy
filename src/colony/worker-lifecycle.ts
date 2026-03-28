import { COLONY } from "./constants";
import type { JobKind } from "./ecs/components/colony-components";

/** Lifecycle stage 1–5 matching cleaning → nurse → builder → guard → forager. */
export type WorkerLifecycleStage = 1 | 2 | 3 | 4 | 5;

/**
 * Milliseconds per bee-day (50 days = full worker lifespan).
 */
export const getMsPerBeeDay = (): number => COLONY.workerLifespanMs / 50;

/**
 * Current bee-day 1–50+ from accumulated age (1-based, clamps at 50 for stage only).
 */
export const getBeeDayOneBased = (ageMs: number): number =>
  Math.floor(ageMs / getMsPerBeeDay()) + 1;

/**
 * Derives worker stage from age. Days 1–2 cleaning, 3–11 nurse, 12–17 builder, 18–21 guard, 22–50 forager.
 */
export const getWorkerLifecycleStage = (ageMs: number): WorkerLifecycleStage => {
  const day = Math.min(50, Math.max(1, getBeeDayOneBased(ageMs)));
  if (day <= 2) {
    return 1;
  }
  if (day <= 11) {
    return 2;
  }
  if (day <= 17) {
    return 3;
  }
  if (day <= 21) {
    return 4;
  }
  return 5;
};

/**
 * Whether {@link kind} is a stage-preferred job (used as assignment weight, not a hard gate).
 */
export const isWorkerStagePreferredJobKind = (
  stage: WorkerLifecycleStage,
  kind: JobKind,
): boolean => {
  if (kind === "layEgg") {
    return false;
  }
  if (kind === "adultFeed") {
    return true;
  }
  switch (stage) {
    case 1:
      return kind === "cleanBrood";
    case 2:
      return kind === "feedLarvae" || kind === "feedQueen";
    case 3:
      return (
        kind === "buildCell" ||
        kind === "honeyProcess" ||
        kind === "clearCellForRetype"
      );
    case 4:
      return kind === "guardHive";
    case 5:
      return (
        kind === "foragePollen" ||
        kind === "forageNectar" ||
        kind === "forageWater" ||
        kind === "waterDeliver"
      );
    default:
      return false;
  }
};

/**
 * Distance bonus (in px) applied when a worker's stage prefers a job kind.
 * Larger values make stage-matching bees more likely to win assignment while keeping flexibility.
 */
export const getWorkerStagePreferenceDistanceBonusPx = (
  stage: WorkerLifecycleStage,
  kind: JobKind,
): number => (isWorkerStagePreferredJobKind(stage, kind) ? 180 : 0);

/** Short label for HUD / debug. */
export const workerStageLabel = (stage: WorkerLifecycleStage): string => {
  switch (stage) {
    case 1:
      return "clean";
    case 2:
      return "nurse";
    case 3:
      return "build";
    case 4:
      return "guard";
    case 5:
      return "forage";
    default:
      return "?";
  }
};
