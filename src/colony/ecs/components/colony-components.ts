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
  nectarStored = 0;
  honeyProcessingProgress = 0;
  eggTimerMs = 0;
  sealedTimerMs = 0;
  cleaningTimerMs = 0;
  larvaeFoodRemaining = 0;
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
  carryPayload: "none" | "pollen" | "nectar" | "water" = "none";
  depositTargetKey: string | null = null;
  /** Adult feed: target bee entity id. */
  adultFeedTargetBeeId: number | null = null;
  /** Scratch values for forage targets (world space). */
  scratchX = 0;
  scratchY = 0;
  /** Feed larvae: pollen taken from storage when job starts. */
  feedReservedPollen = 0;
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
}

export class BeeCarryComponent extends Component {
  carry: "none" | "pollen" | "nectar" | "water" = "none";
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
  pollen = 0;
  honey = 0;
  colonyNectar = 0;
}

export class QueenTimerComponent extends Component {
  layCooldownMs = 0;
}
