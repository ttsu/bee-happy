import type { Vector } from "excalibur";
import type { HexCoord } from "../../grid/hex-grid";
import { HEX_DIRECTIONS, hexToWorld } from "../../grid/hex-grid";
import type { HiveCoord } from "../../grid/hive-levels";

const keyOf = (q: number, r: number): string => `${q},${r}`;

/**
 * Walkable = built hexes plus their six neighbors (bees may traverse adjacent empty hexes).
 */
export const buildWalkableKeysForLevel = (
  builtCoordsOnLevel: Iterable<HexCoord>,
): Set<string> => {
  const built = new Set<string>();
  for (const h of builtCoordsOnLevel) {
    built.add(keyOf(h.q, h.r));
  }
  const walk = new Set<string>(built);
  for (const k of built) {
    const [q, r] = k.split(",").map(Number) as [number, number];
    for (const d of HEX_DIRECTIONS) {
      walk.add(keyOf(q + d.q, r + d.r));
    }
  }
  return walk;
};

const bfsSameLevel = (
  start: HexCoord,
  goal: HexCoord,
  walkable: Set<string>,
): HexCoord[] | null => {
  const startK = keyOf(start.q, start.r);
  const goalK = keyOf(goal.q, goal.r);
  if (!walkable.has(startK) || !walkable.has(goalK)) {
    return null;
  }
  if (startK === goalK) {
    return [start];
  }
  const prev = new Map<string, string | null>();
  const q: string[] = [startK];
  prev.set(startK, null);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goalK) {
      const out: HexCoord[] = [];
      let ck: string | null = goalK;
      while (ck) {
        const [x, y] = ck.split(",").map(Number) as [number, number];
        out.push({ q: x, r: y });
        ck = prev.get(ck) ?? null;
      }
      out.reverse();
      return out;
    }
    const [cq, cr] = cur.split(",").map(Number) as [number, number];
    for (const d of HEX_DIRECTIONS) {
      const nk = keyOf(cq + d.q, cr + d.r);
      if (!walkable.has(nk) || prev.has(nk)) {
        continue;
      }
      prev.set(nk, cur);
      q.push(nk);
    }
  }
  return null;
};

const collectBuiltCoords = (
  level: number,
  builtByLevel: Map<number, Set<string>>,
): HexCoord[] => {
  const set = builtByLevel.get(level);
  if (!set) {
    return [];
  }
  const out: HexCoord[] = [];
  for (const k of set) {
    const [q, r] = k.split(",").map(Number) as [number, number];
    out.push({ q, r });
  }
  return out;
};

/**
 * Converts a chain of hexes to world points along the path.
 */
export const hexPathToWorldPoints = (hexes: HexCoord[], hexSize: number): Vector[] =>
  hexes.map((h) => hexToWorld(h, hexSize));

/**
 * Plans a world-space polyline from start to goal. Uses same-level BFS; if levels differ,
 * connects via the goal axial coordinate (bee moves vertically at that hex when both levels have built cells).
 */
export const findHexPathWorldPoints = (
  start: HiveCoord,
  goal: HiveCoord,
  hexSize: number,
  builtByLevel: Map<number, Set<string>>,
): Vector[] => {
  if (start.level === goal.level) {
    const walk = buildWalkableKeysForLevel(
      collectBuiltCoords(start.level, builtByLevel),
    );
    const path = bfsSameLevel(start, goal, walk);
    if (!path) {
      return [hexToWorld(start, hexSize), hexToWorld(goal, hexSize)];
    }
    return hexPathToWorldPoints(path, hexSize);
  }

  const a = findHexPathWorldPoints(
    start,
    { q: goal.q, r: goal.r, level: start.level },
    hexSize,
    builtByLevel,
  );
  const b = findHexPathWorldPoints(
    { q: goal.q, r: goal.r, level: goal.level },
    goal,
    hexSize,
    builtByLevel,
  );
  return a.slice(0, -1).concat(b);
};

/** World waypoint with hive level (vertical moves reuse the same world position with a new level). */
export type HexPathWaypoint = { world: Vector; level: number };

/**
 * Same routing as {@link findHexPathWorldPoints}, but each point includes the hive level the bee
 * should be on after reaching it (so cross-level routes include a vertical leg at the junction hex).
 */
export const findHexPathWorldPointsWithLevels = (
  start: HiveCoord,
  goal: HiveCoord,
  hexSize: number,
  builtByLevel: Map<number, Set<string>>,
): HexPathWaypoint[] => {
  if (start.level === goal.level) {
    const walk = buildWalkableKeysForLevel(
      collectBuiltCoords(start.level, builtByLevel),
    );
    const path = bfsSameLevel(start, goal, walk);
    if (!path) {
      return [
        { world: hexToWorld(start, hexSize), level: start.level },
        { world: hexToWorld(goal, hexSize), level: goal.level },
      ];
    }
    return path.map((h) => ({
      world: hexToWorld(h, hexSize),
      level: start.level,
    }));
  }

  const toJunctionOnStart = findHexPathWorldPointsWithLevels(
    start,
    { q: goal.q, r: goal.r, level: start.level },
    hexSize,
    builtByLevel,
  );
  const fromJunctionOnGoal = findHexPathWorldPointsWithLevels(
    { q: goal.q, r: goal.r, level: goal.level },
    goal,
    hexSize,
    builtByLevel,
  );
  if (toJunctionOnStart.length === 0) {
    return fromJunctionOnGoal;
  }
  if (fromJunctionOnGoal.length === 0) {
    return toJunctionOnStart;
  }
  const lastOnStart = toJunctionOnStart[toJunctionOnStart.length - 1]!;
  const firstOnGoal = fromJunctionOnGoal[0]!;
  return [
    ...toJunctionOnStart.slice(0, -1),
    lastOnStart,
    { world: firstOnGoal.world, level: goal.level },
    ...fromJunctionOnGoal.slice(1),
  ];
};
