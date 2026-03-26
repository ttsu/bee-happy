import type { Vector } from "excalibur";
import { Component } from "excalibur";

export type BeeRole = "queen" | "worker";
export type BeeAvailability = "available" | "busy";
export type CellStage =
  | "foundation"
  | "empty"
  | "egg"
  | "larvae"
  | "sealed"
  | "cleaning";
export type CellTypeKind = "none" | "brood" | "pollen" | "nectar";

export type JobKind =
  | "buildCell"
  | "layEgg"
  | "feedLarvae"
  | "cleanBrood"
  | "foragePollen"
  | "forageNectar"
  | "forageWater"
  | "depositPollen"
  | "depositNectar"
  | "depositWater"
  | "honeyProcess"
  | "adultFeed"
  | "waterDeliver";

/** Axial + level identity for a hive cell entity. */
export class CellCoordComponent extends Component {
  constructor(
    public q: number,
    public r: number,
    public level: number,
  ) {
    super();
  }
}

/** Build, brood, and storage state for a cell. */
export class CellStateComponent extends Component {
  built = false;
  stage: CellStage = "foundation";
  buildProgress = 0;
  cellType: CellTypeKind = "none";
  /** Pollen units in this cell when {@link cellType} is `pollen`. */
  pollenStored = 0;
  nectarStored = 0;
  /** Honey units in this cell after nectar is processed; nectar deposits blocked until this is 0. */
  honeyStored = 0;
  honeyProcessingProgress = 0;
  eggTimerMs = 0;
  sealedTimerMs = 0;
  cleaningTimerMs = 0;
  /** Portions of pollen still required before pupation (fed from pollen storage cells). */
  larvaePollenRemaining = 0;
  /** Portions of nectar/honey still required before pupation (fed from nectar cells / honey). */
  larvaeNectarRemaining = 0;
  /** When true, honey job may be interrupted for adult nectar use. */
  honeyProcessingDirty = false;
}

/** Job queue entity. */
export class JobComponent extends Component {
  reservedBeeIds: number[] = [];
  status: "open" | "active" | "done" = "open";
  pathPoints: Vector[] = [];
  foragePhase: "outbound" | "wait" | "return" | "idle" = "idle";
  forageWaitMs = 0;
  carryPayload: "none" | "pollen" | "nectar" | "honey" | "water" = "none";
  depositTargetKey: string | null = null;
  /** Adult feed: target bee entity id. */
  adultFeedTargetBeeId: number | null = null;
  /** Scratch values for forage targets (world space). */
  scratchX = 0;
  scratchY = 0;
  /**
   * Feed larvae: travel → timed gather at food cell → travel → timed deposit at brood.
   */
  feedLarvaePhase: "toPickup" | "collecting" | "toDeliver" | "depositing" = "toPickup";
  /** Counts down during {@link feedLarvaePhase} `collecting` or `depositing`. */
  feedLarvaePhaseTimerMs = 0;
  feedPickupQ = 0;
  feedPickupR = 0;
  feedPickupLevel = 0;
  /** Active leg: what the bee will pick up at {@link feedPickupQ}/R or is carrying to brood. */
  feedCargoKind: "none" | "pollen" | "nectar" | "honey" = "none";
  constructor(
    public kind: JobKind,
    public priority: number,
    public targetQ: number,
    public targetR: number,
    public targetLevel: number,
    public beesNeeded: number,
  ) {
    super();
  }
}

export class BeeRoleComponent extends Component {
  constructor(public role: BeeRole) {
    super();
  }
}

export class BeeWorkComponent extends Component {
  availability: BeeAvailability = "available";
  currentJobEntityId: number | null = null;
  pathIndex = 0;
  /** World target for idle wandering when unassigned and no eligible open jobs. */
  idleWanderTarget: Vector | null = null;
  /** Time left in the current idle rest (no movement); ms. */
  idleWanderPauseRemainingMs = 0;
}

export class BeeCarryComponent extends Component {
  carry: "none" | "pollen" | "nectar" | "honey" | "water" = "none";
}

export class BeeNeedsComponent extends Component {
  hunger = 18;
  thirst = 18;
}

/** Current vertical level for this bee actor. */
export class BeeLevelComponent extends Component {
  constructor(public level: number) {
    super();
  }
}

export class ActiveLevelComponent extends Component {
  activeLevel = 0;
  transition: "idle" | "fadeOut" | "fadeIn" = "idle";
  pendingLevel: number | null = null;
  transitionT = 0;
}

export class ColonyResourcesComponent extends Component {
  wax = 0;
  colonyNectar = 0;
}

export class QueenTimerComponent extends Component {
  layCooldownMs = 0;
}
