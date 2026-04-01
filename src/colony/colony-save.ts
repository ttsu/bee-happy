/**
 * Colony persistence: re-exports split modules for a stable import path (`colony/colony-save`).
 */

export {
  SAVE_STORAGE_KEY,
  SAVE_INDEX_KEY,
  SAVE_SLOT_KEY_PREFIX,
  ACTIVE_SAVE_SLOT_SESSION_KEY,
  SAVE_FORMAT_VERSION,
  SAVE_INDEX_FORMAT_VERSION,
} from "./save/colony-save-types";

export type {
  SaveIndexEntry,
  SaveIndexV1,
  Vec2Json,
  CellStateJson,
  JobComponentJson,
  BeeJson,
  ActiveLevelJson,
  YearlyStatsJson,
  ColonySaveV1,
  LoadPayload,
} from "./save/colony-save-types";

export {
  syncMetaFromSaveData,
  serializeColonySave,
  parseColonySaveJson,
} from "./save/colony-save-codec";

export { applyColonySave } from "./save/colony-save-apply";

export {
  readSaveIndex,
  listSaveSlotsNewestFirst,
  getColonySaveForSlot,
  ensureActiveSaveSlotForNewGame,
  setActiveSaveSlotSession,
  readColonySaveFromStorage,
  writeColonySaveToStorage,
  deleteSaveSlot,
  clearAllColonySavesFromStorage,
  clearColonySaveFromStorage,
} from "./save/colony-save-storage";
