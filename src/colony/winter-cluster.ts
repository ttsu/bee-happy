import { vec, type Actor, type Vector } from "excalibur";
import { getActiveColonyConstants } from "./colony-active-constants";
import type { ColonyRuntime } from "./colony-runtime";
import { COLONY } from "./constants";
import {
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyTimeComponent,
} from "./ecs/components/colony-components";
import { hexToWorld } from "../grid/hex-grid";
import { getSeasonForColonyDay, type Season } from "./seasons";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Colony calendar season from elapsed simulation time.
 */
export const getColonySeason = (colony: ColonyRuntime): Season => {
  const time = colony.controllerEntity.get(ColonyTimeComponent);
  const msPerBeeDay = COLONY.workerLifespanMs / 50;
  const currentColonyDay = time
    ? Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1
    : 1;
  return getSeasonForColonyDay(currentColonyDay, colony.daysPerSeason).season;
};

/**
 * 0–1 pulse for synchronized winter cluster shiver bursts (heat-generation motion).
 */
export const winterClusterActivityBurst = (colonyElapsedMs: number): number => {
  const period = COLONY.winterClusterActivityBurstPeriodMs;
  const t = (colonyElapsedMs % period) / period;
  const wave = Math.sin(t * Math.PI * 2);
  return wave * wave;
};

/**
 * World-space center for the winter cluster on a hive level (queen position, else comb centroid).
 */
export const winterClusterCenter = (colony: ColonyRuntime, level: number): Vector => {
  for (const actor of colony.scene.actors) {
    const role = actor.get(BeeRoleComponent);
    const lvl = actor.get(BeeLevelComponent);
    if (role?.role === "queen" && lvl?.level === level) {
      return actor.pos.clone();
    }
  }

  const C = getActiveColonyConstants();
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const [, ent] of colony.cellsByKey) {
    const coord = ent.get(CellCoordComponent);
    const st = ent.get(CellStateComponent);
    if (!coord || !st?.built || coord.level !== level) {
      continue;
    }
    const w = hexToWorld({ q: coord.q, r: coord.r }, C.hexSize);
    sumX += w.x;
    sumY += w.y;
    count += 1;
  }
  if (count > 0) {
    return vec(sumX / count, sumY / count);
  }
  return vec(0, 0);
};

/**
 * Idle worker slot on a disk around the cluster center (sunflower-style packing).
 */
export const winterClusterWorkerTarget = (
  center: Vector,
  beeId: number,
  colonyElapsedMs: number,
  workerCountOnLevel: number,
): Vector => {
  const burst = winterClusterActivityBurst(colonyElapsedMs);
  const maxRadius =
    COLONY.winterClusterRadiusPx *
    Math.min(1.35, 0.55 + Math.sqrt(Math.max(1, workerCountOnLevel)) * 0.18);

  const slotIndex = beeId;
  const thetaBase = (slotIndex * GOLDEN_ANGLE) % (Math.PI * 2);
  const radiusFrac = Math.sqrt(((slotIndex * 0.6180339887) % 1) * 0.92 + 0.08);
  const radius = maxRadius * radiusFrac;

  const phase = colonyElapsedMs * 0.0025 + slotIndex * 0.37;
  const wobbleTheta =
    Math.sin(phase * 0.85) * COLONY.winterClusterWobbleAngleRad * (0.35 + burst * 0.65);
  const wobbleRadius =
    Math.cos(phase * 1.12) * COLONY.winterClusterWobbleRadiusPx * (0.4 + burst * 0.6);

  const theta = thetaBase + wobbleTheta;
  const r = Math.max(2, radius + wobbleRadius);

  return vec(center.x + Math.cos(theta) * r, center.y + Math.sin(theta) * r);
};

/**
 * Queen stays at cluster heart with a tiny periodic shift during heat bursts.
 */
export const winterClusterQueenTarget = (
  center: Vector,
  colonyElapsedMs: number,
): Vector => {
  const burst = winterClusterActivityBurst(colonyElapsedMs);
  const phase = colonyElapsedMs * 0.0018;
  const jitter = COLONY.winterClusterQueenJitterPx * burst;
  return vec(
    center.x + Math.sin(phase) * jitter,
    center.y + Math.cos(phase * 0.93) * jitter,
  );
};

/** Count available idle workers on a level (winter cluster sizing). */
export const countIdleWorkersOnLevel = (
  colony: ColonyRuntime,
  level: number,
): number => {
  let count = 0;
  for (const actor of colony.scene.actors) {
    const role = actor.get(BeeRoleComponent);
    const lvl = actor.get(BeeLevelComponent);
    const work = actor.get(BeeWorkComponent);
    if (role?.role !== "worker" || lvl?.level !== level || !work) {
      continue;
    }
    if (work.currentJobEntityId !== null || work.availability !== "available") {
      continue;
    }
    count += 1;
  }
  return count;
};

export const moveActorToward = (
  actor: Actor,
  target: Vector,
  speedPerMs: number,
  elapsed: number,
): void => {
  const to = target.sub(actor.pos);
  const dist = to.size;
  if (dist < 0.5) {
    return;
  }
  const step = speedPerMs * elapsed;
  const moveDist = Math.min(step, dist);
  actor.pos = actor.pos.add(to.normalize().scale(moveDist));
};
