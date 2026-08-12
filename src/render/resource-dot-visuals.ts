import {
  vec,
  type Actor,
  type ExcaliburGraphicsContext,
  type Vector,
  type World,
} from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import { getActiveColonyConstants } from "../colony/colony-active-constants";
import type { EffectiveColonyConstants } from "../colony/effective-colony";
import { COLONY } from "../colony/constants";
import { hexToWorld } from "../grid/hex-grid";
import {
  BeeCarryComponent,
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  JobComponent,
} from "../colony/ecs/components/colony-components";
import {
  drawResourceDot,
  easeFlight,
  layoutBeeCarryDots,
  layoutCellDots,
  type ResourceKind,
} from "./resource-dots";

export type TransferMode = "arrive" | "consume";

type TransferEndpoint =
  | { type: "cell"; cellKey: string }
  | { type: "bee"; beeId: number }
  | { type: "world"; pos: Vector };

type FlyingDot = {
  kind: ResourceKind;
  from: Vector;
  to: Vector;
  elapsed: number;
  delayMs: number;
  mode: TransferMode;
  slotIndex: number;
  sourceCellKey?: string;
  targetCellKey?: string;
  sourceBeeId?: number;
  targetBeeId?: number;
};

type KindCounts = Partial<Record<ResourceKind, number>>;

const findJobEntity = (world: World, id: number) =>
  world.entities.find((e) => e.id === id);

const bumpKind = (
  map: Map<string, KindCounts>,
  key: string,
  kind: ResourceKind,
  delta: number,
) => {
  const cur = map.get(key) ?? {};
  cur[kind] = (cur[kind] ?? 0) + delta;
  if (cur[kind]! <= 0) {
    delete cur[kind];
  }
  if (Object.keys(cur).length === 0) {
    map.delete(key);
  } else {
    map.set(key, cur);
  }
};

const bumpBeeKind = (
  map: Map<number, KindCounts>,
  beeId: number,
  kind: ResourceKind,
  delta: number,
) => {
  const cur = map.get(beeId) ?? {};
  cur[kind] = (cur[kind] ?? 0) + delta;
  if (cur[kind]! <= 0) {
    delete cur[kind];
  }
  if (Object.keys(cur).length === 0) {
    map.delete(beeId);
  } else {
    map.set(beeId, cur);
  }
};

export const resolveLogicalBeeCarry = (
  bee: Actor,
  world: World,
  C: EffectiveColonyConstants,
): { kind: ResourceKind; count: number } | null => {
  const work = bee.get(BeeWorkComponent);
  if (work?.currentJobEntityId != null) {
    const jobEnt = findJobEntity(world, work.currentJobEntityId);
    const job = jobEnt?.get(JobComponent);
    if (job && job.status !== "done" && job.carryPayload !== "none") {
      if (job.kind === "foragePollen") {
        return { kind: "pollen", count: C.foragePollenDepositAmount };
      }
      if (job.kind === "forageNectar") {
        return { kind: "nectar", count: C.forageNectarDepositAmount };
      }
      if (job.kind === "feedLarvae") {
        const count =
          job.feedCargoKind === "honey" ? C.larvaeFeedHoneyCost : C.pollenPerFeedUnit;
        return { kind: job.carryPayload as ResourceKind, count };
      }
    }
  }
  const carry = bee.get(BeeCarryComponent)?.carry;
  if (carry && carry !== "none") {
    return { kind: carry, count: 1 };
  }
  return null;
};

/**
 * Canvas resource-dot manager: cell stock, bee carry, and in-flight transfers.
 */
export class ResourceDotVisuals {
  private readonly flying: FlyingDot[] = [];
  /** Dots still visually at cell after sim pickup (cell→bee). */
  private readonly pendingFromCell = new Map<string, KindCounts>();
  /** Dots in flight to cell before sim deposit shows (bee→cell). */
  private readonly pendingToCell = new Map<string, KindCounts>();
  /** Dots in flight away from bee (bee→cell/larvae). */
  private readonly pendingFromBee = new Map<number, KindCounts>();
  /** Dots in flight to bee before carry appears (cell/flower→bee). */
  private readonly pendingToBee = new Map<number, KindCounts>();

  clear(): void {
    this.flying.length = 0;
    this.pendingFromCell.clear();
    this.pendingToCell.clear();
    this.pendingFromBee.clear();
    this.pendingToBee.clear();
  }

  update(elapsed: number): void {
    const duration = COLONY.resourceDotFlightMs;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      f.elapsed += elapsed;
      const active = f.elapsed - f.delayMs;
      if (active < duration) {
        continue;
      }
      this.completeFlight(f);
      this.flying.splice(i, 1);
    }
  }

  spawnTransfer(opts: {
    kind: ResourceKind;
    count: number;
    from: TransferEndpoint;
    to: TransferEndpoint;
    mode: TransferMode;
    colony: ColonyRuntime;
  }): void {
    const { kind, count, from, to, mode, colony } = opts;
    if (count <= 0) {
      return;
    }
    const fromPos = this.resolveEndpoint(from, colony, kind, 0);
    const toPos = this.resolveEndpoint(to, colony, kind, 0);
    if (!fromPos || !toPos) {
      return;
    }

    if (from.type === "cell") {
      bumpKind(this.pendingFromCell, from.cellKey, kind, count);
    }
    if (to.type === "cell") {
      bumpKind(this.pendingToCell, to.cellKey, kind, count);
    }
    if (from.type === "bee") {
      bumpBeeKind(this.pendingFromBee, from.beeId, kind, count);
    }
    if (to.type === "bee" && mode === "arrive") {
      bumpBeeKind(this.pendingToBee, to.beeId, kind, count);
    }

    for (let i = 0; i < count; i++) {
      const slotIndex = i;
      const stagger = i * COLONY.resourceDotStaggerMs;
      const fFrom = this.resolveEndpoint(from, colony, kind, slotIndex) ?? fromPos;
      const fTo = this.resolveEndpoint(to, colony, kind, slotIndex) ?? toPos;
      this.flying.push({
        kind,
        from: fFrom,
        to: fTo,
        elapsed: 0,
        delayMs: stagger,
        mode,
        slotIndex,
        sourceCellKey: from.type === "cell" ? from.cellKey : undefined,
        targetCellKey: to.type === "cell" ? to.cellKey : undefined,
        sourceBeeId: from.type === "bee" ? from.beeId : undefined,
        targetBeeId: to.type === "bee" ? to.beeId : undefined,
      });
    }
  }

  getCellVisualCount(cellKey: string, kind: ResourceKind, simCount: number): number {
    const hold = this.pendingFromCell.get(cellKey)?.[kind] ?? 0;
    const delay = this.pendingToCell.get(cellKey)?.[kind] ?? 0;
    return Math.max(0, simCount + hold - delay);
  }

  getBeeVisualCarry(
    bee: Actor,
    world: World,
  ): { kind: ResourceKind; count: number } | null {
    const C = getActiveColonyConstants();
    const logical = resolveLogicalBeeCarry(bee, world, C);
    if (!logical) {
      return null;
    }
    const from = this.pendingFromBee.get(bee.id)?.[logical.kind] ?? 0;
    const to = this.pendingToBee.get(bee.id)?.[logical.kind] ?? 0;
    const count = logical.count - from - to;
    if (count <= 0) {
      return null;
    }
    return { kind: logical.kind, count };
  }

  drawCellDots(ctx: ExcaliburGraphicsContext, colony: ColonyRuntime): void {
    const lvl = colony.activeLevel;
    const S = COLONY.hexSize;
    for (const [key, ent] of colony.cellsByKey) {
      const coord = ent.get(CellCoordComponent)!;
      if (coord.level !== lvl) {
        continue;
      }
      const st = ent.get(CellStateComponent)!;
      if (!st.built) {
        continue;
      }
      const center = hexToWorld({ q: coord.q, r: coord.r }, S);
      if (st.cellType === "pollen") {
        const n = this.getCellVisualCount(key, "pollen", Math.round(st.pollenStored));
        const slots = layoutCellDots(n, center);
        for (let i = 0; i < slots.length; i++) {
          drawResourceDot(ctx, slots[i]!, "pollen", i);
        }
      } else if (st.cellType === "nectar") {
        if (st.honeyStored > 1e-6) {
          const n = this.getCellVisualCount(key, "honey", Math.round(st.honeyStored));
          const slots = layoutCellDots(n, center);
          for (let i = 0; i < slots.length; i++) {
            drawResourceDot(ctx, slots[i]!, "honey", i);
          }
        } else {
          const n = this.getCellVisualCount(key, "nectar", Math.round(st.nectarStored));
          const slots = layoutCellDots(n, center);
          for (let i = 0; i < slots.length; i++) {
            drawResourceDot(ctx, slots[i]!, "nectar", i);
          }
        }
      }
    }
  }

  drawOverlays(ctx: ExcaliburGraphicsContext, colony: ColonyRuntime): void {
    const active = colony.activeLevel;
    const world = colony.scene.world;
    for (const actor of colony.scene.actors) {
      const lvl = actor.get(BeeLevelComponent);
      const role = actor.get(BeeRoleComponent);
      if (!lvl || lvl.level !== active || role?.role !== "worker") {
        continue;
      }
      const carry = this.getBeeVisualCarry(actor, world);
      if (!carry) {
        continue;
      }
      const slots = layoutBeeCarryDots(carry.count, actor.pos, actor.rotation);
      for (let i = 0; i < slots.length; i++) {
        drawResourceDot(ctx, slots[i]!, carry.kind, i);
      }
    }

    const duration = COLONY.resourceDotFlightMs;
    for (const f of this.flying) {
      const activeMs = f.elapsed - f.delayMs;
      if (activeMs < 0) {
        continue;
      }
      const t = easeFlight(activeMs / duration);
      const pos = vec(
        f.from.x + (f.to.x - f.from.x) * t,
        f.from.y + (f.to.y - f.from.y) * t,
      );
      drawResourceDot(ctx, pos, f.kind, f.slotIndex);
    }
  }

  private completeFlight(f: FlyingDot): void {
    if (f.sourceCellKey) {
      bumpKind(this.pendingFromCell, f.sourceCellKey, f.kind, -1);
    }
    if (f.targetCellKey) {
      bumpKind(this.pendingToCell, f.targetCellKey, f.kind, -1);
    }
    if (f.sourceBeeId != null) {
      bumpBeeKind(this.pendingFromBee, f.sourceBeeId, f.kind, -1);
    }
    if (f.targetBeeId != null && f.mode === "arrive") {
      bumpBeeKind(this.pendingToBee, f.targetBeeId, f.kind, -1);
    }
  }

  private resolveEndpoint(
    ep: TransferEndpoint,
    colony: ColonyRuntime,
    kind: ResourceKind,
    slotIndex: number,
  ): Vector | null {
    const S = COLONY.hexSize;
    if (ep.type === "world") {
      return ep.pos;
    }
    if (ep.type === "bee") {
      const bee = colony.scene.actors.find((a) => a.id === ep.beeId);
      if (!bee) {
        return null;
      }
      const C = getActiveColonyConstants();
      const logical = resolveLogicalBeeCarry(bee, colony.scene.world, C);
      const layoutCount = logical?.count ?? 1;
      const slots = layoutBeeCarryDots(layoutCount, bee.pos, bee.rotation);
      return slots[slotIndex] ?? slots[slots.length - 1] ?? bee.pos;
    }
    const ent = colony.getCellAt(ep.cellKey);
    if (!ent) {
      return null;
    }
    const coord = ent.get(CellCoordComponent)!;
    const st = ent.get(CellStateComponent)!;
    const center = hexToWorld({ q: coord.q, r: coord.r }, S);
    let simCount = 0;
    if (kind === "pollen") {
      simCount = Math.round(st.pollenStored);
    } else if (kind === "nectar") {
      simCount = Math.round(st.nectarStored);
    } else {
      simCount = Math.round(st.honeyStored);
    }
    const visual = this.getCellVisualCount(ep.cellKey, kind, simCount);
    const slots = layoutCellDots(visual, center);
    return slots[slotIndex] ?? slots[slots.length - 1] ?? vec(center.x, center.y);
  }
}
