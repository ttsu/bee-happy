import type {
  ActiveLevelComponent,
  BeeCarryComponent,
  BeeRole,
  CellStage,
  CellTypeKind,
  ColonyTimeComponent,
  JobComponent,
  JobKind,
  QueenTimerComponent,
  YearlyStatsComponent,
} from "../ecs/components/colony-components";
import type { SeasonSystemSave } from "../ecs/systems/season-system";
import type { HiveCoord } from "../../grid/hive-levels";
import type { GameSettings } from "../game-settings";
import type { MetaProgressV1 } from "../meta/meta-progress";

/** @deprecated Legacy single-save key; migrated into slots on first read of the index. */
export const SAVE_STORAGE_KEY = "bee-happy-save-v1";

export const SAVE_INDEX_KEY = "bee-happy-save-index-v1";
export const SAVE_SLOT_KEY_PREFIX = "bee-happy-save-slot-v1-";

/** Session-only: which save slot the running game writes to (set when starting from the menu). */
export const ACTIVE_SAVE_SLOT_SESSION_KEY = "bee-happy-active-save-slot-id";

export const SAVE_FORMAT_VERSION = 1 as const;
export const SAVE_INDEX_FORMAT_VERSION = 1 as const;

export type SaveIndexEntry = {
  slotId: string;
  /** Shown in the load list; assigned when the slot is first persisted. */
  slotLabel: string;
  /** Last successful write time (from {@link ColonySaveV1.savedAtIso}). */
  savedAtIso: string;
};

/** Index row plus rule flags read from the slot JSON (for the launch menu). */
export type SaveSlotWithRuleFlags = SaveIndexEntry & {
  readonly lineageSystemEnabled: boolean;
  readonly intrudersEnabled: boolean;
};

export type SaveIndexV1 = {
  formatVersion: typeof SAVE_INDEX_FORMAT_VERSION;
  slots: SaveIndexEntry[];
};

export type Vec2Json = { x: number; y: number };

export type CellStateJson = {
  built: boolean;
  stage: CellStage;
  buildProgress: number;
  cellType: CellTypeKind;
  pollenStored: number;
  nectarStored: number;
  honeyStored: number;
  honeyProcessingProgress: number;
  eggTimerMs: number;
  sealedTimerMs: number;
  cleaningTimerMs: number;
  larvaePollenRemaining: number;
  larvaeNectarRemaining: number;
  honeyProcessingDirty: boolean;
  pendingCellType: "brood" | "pollen" | "nectar" | null;
};

export type JobComponentJson = {
  kind: JobKind;
  priority: number;
  targetQ: number;
  targetR: number;
  targetLevel: number;
  beesNeeded: number;
  reservedBeeIds: number[];
  status: "open" | "active" | "done";
  pathPoints: Vec2Json[];
  /** Added in a later format; omitted in older saves. */
  pathLevels?: number[];
  foragePhase: JobComponent["foragePhase"];
  forageWaitMs: number;
  forageCapacityPollMs: number;
  carryPayload: JobComponent["carryPayload"];
  depositTargetKey: string | null;
  adultFeedTargetBeeId: number | null;
  selfFeedCellKey: string | null;
  feedQueenTimerMs: number;
  layEggTimerMs: number;
  guardHiveTimerMs: number;
  scratchX: number;
  scratchY: number;
  feedLarvaePhase: JobComponent["feedLarvaePhase"];
  feedLarvaePhaseTimerMs: number;
  feedPickupQ: number;
  feedPickupR: number;
  feedPickupLevel: number;
  feedCargoKind: JobComponent["feedCargoKind"];
  retypePhase: JobComponent["retypePhase"];
  retypeClearAccumMs: number;
};

export type BeeJson = {
  role: BeeRole;
  level: number;
  pos: Vec2Json;
  rotation: number;
  work: {
    availability: "available" | "busy";
    currentJobEntityId: number | null;
    pathIndex: number;
    idleWanderTarget: Vec2Json | null;
    idleWanderPauseRemainingMs: number;
  };
  carry: BeeCarryComponent["carry"];
  needs: { hunger: number; thirst: number };
  ageMs: number | null;
};

export type ActiveLevelJson = Pick<
  ActiveLevelComponent,
  "activeLevel" | "transition" | "pendingLevel" | "transitionT"
>;

export type YearlyStatsJson = Pick<
  YearlyStatsComponent,
  | "yearNumber"
  | "isYearReviewOpen"
  | "honeyProcessedTotal"
  | "nectarCollectedTotal"
  | "pollenCollectedTotal"
  | "beesHatchedTotal"
  | "happyBeeSecondsTotal"
  | "remainingBeesAtYearEnd"
>;

export type ColonySaveV1 = {
  formatVersion: typeof SAVE_FORMAT_VERSION;
  savedAtIso: string;
  camera: Vec2Json;
  activeLevel: ActiveLevelJson;
  queenTimer: Pick<QueenTimerComponent, "layCooldownMs">;
  colonyTime: Pick<ColonyTimeComponent, "colonyElapsedMs">;
  yearly: YearlyStatsJson;
  seasonSystem: SeasonSystemSave;
  runtime: {
    pendingCellTypeKey: string | null;
    cellTypeChangeError: string | null;
    cellTypeChangeDiscardTarget: "brood" | "pollen" | "nectar" | null;
    transitionOverlay: number;
    /** Omitted in older saves; load defaults to `"brood"`. */
    selectedPlacementCellType?: "brood" | "pollen" | "nectar";
  };
  cells: { key: string; coord: HiveCoord; state: CellStateJson }[];
  /** Stable order: entity id at save time + job payload (ids remapped on load). */
  jobs: { entityId: number; job: JobComponentJson }[];
  /** Stable order: entity id at save time + bee payload. */
  bees: { entityId: number; bee: BeeJson }[];
  /**
   * Queen lineage and succession meta (same schema as {@link MetaProgressV1}).
   * Omitted in older saves; load falls back to legacy meta storage then defaults.
   */
  meta?: MetaProgressV1;
  /** Rules chosen at new game or carried from prior format; omitted in older saves. */
  gameSettings?: GameSettings;
};

export type LoadPayload = {
  data: ColonySaveV1;
  seasonSystem: SeasonSystemSave;
};
