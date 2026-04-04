import { gameSettingsFromSave } from "../game-settings";
import { parseColonySaveJson } from "./colony-save-codec";
import {
  ACTIVE_SAVE_SLOT_SESSION_KEY,
  SAVE_INDEX_FORMAT_VERSION,
  SAVE_INDEX_KEY,
  SAVE_SLOT_KEY_PREFIX,
  SAVE_STORAGE_KEY,
  type ColonySaveV1,
  type SaveIndexEntry,
  type SaveIndexV1,
  type SaveSlotWithRuleFlags,
} from "./colony-save-types";

function parseSaveIndexJson(raw: string | null): SaveIndexV1 | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.formatVersion !== SAVE_INDEX_FORMAT_VERSION) {
      return null;
    }
    const slots = o.slots;
    if (!Array.isArray(slots)) {
      return null;
    }
    return parsed as SaveIndexV1;
  } catch {
    return null;
  }
}

function slotStorageKey(slotId: string): string {
  return `${SAVE_SLOT_KEY_PREFIX}${slotId}`;
}

function migrateLegacySaveIntoIndex(): SaveIndexV1 | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = parseColonySaveJson(raw);
    if (!data) {
      return null;
    }
    const slotId = crypto.randomUUID();
    const label = `Colony 1`;
    localStorage.setItem(slotStorageKey(slotId), raw);
    const index: SaveIndexV1 = {
      formatVersion: SAVE_INDEX_FORMAT_VERSION,
      slots: [
        {
          slotId,
          slotLabel: label,
          savedAtIso: data.savedAtIso,
        },
      ],
    };
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
    localStorage.removeItem(SAVE_STORAGE_KEY);
    return index;
  } catch {
    return null;
  }
}

/**
 * Reads the save slot index, migrating a legacy single-key save if present.
 */
export function readSaveIndex(): SaveIndexV1 {
  try {
    const parsed = parseSaveIndexJson(localStorage.getItem(SAVE_INDEX_KEY));
    if (parsed) {
      return parsed;
    }
    const migrated = migrateLegacySaveIntoIndex();
    if (migrated) {
      return migrated;
    }
    return { formatVersion: SAVE_INDEX_FORMAT_VERSION, slots: [] };
  } catch {
    return { formatVersion: SAVE_INDEX_FORMAT_VERSION, slots: [] };
  }
}

function writeSaveIndex(index: SaveIndexV1): void {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

/**
 * Save slots for the launch menu, newest first.
 */
export function listSaveSlotsNewestFirst(): SaveIndexEntry[] {
  const { slots } = readSaveIndex();
  return [...slots].sort((a, b) => {
    const ta = Date.parse(a.savedAtIso);
    const tb = Date.parse(b.savedAtIso);
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    return nb - na;
  });
}

export function getColonySaveForSlot(slotId: string): ColonySaveV1 | null {
  try {
    const raw = localStorage.getItem(slotStorageKey(slotId));
    if (!raw) {
      return null;
    }
    return parseColonySaveJson(raw);
  } catch {
    return null;
  }
}

/**
 * Same order as {@link listSaveSlotsNewestFirst}, with `gameSettings` flags from each slot file.
 * Missing or unreadable slots yield both flags false.
 */
export function listSaveSlotsNewestFirstWithRuleFlags(): SaveSlotWithRuleFlags[] {
  return listSaveSlotsNewestFirst().map((entry) => {
    const data = getColonySaveForSlot(entry.slotId);
    if (!data) {
      return {
        ...entry,
        lineageSystemEnabled: false,
        intrudersEnabled: false,
      };
    }
    const gs = gameSettingsFromSave(data.gameSettings);
    return {
      ...entry,
      lineageSystemEnabled: gs.lineageSystemEnabled,
      intrudersEnabled: gs.intrudersEnabled,
    };
  });
}

function nextDefaultSlotLabel(slots: SaveIndexEntry[]): string {
  let max = 0;
  const re = /^Colony\s+(\d+)$/i;
  for (const s of slots) {
    const m = re.exec(s.slotLabel.trim());
    if (m) {
      const n = Number.parseInt(m[1]!, 10);
      if (!Number.isNaN(n)) {
        max = Math.max(max, n);
      }
    }
  }
  return `Colony ${max + 1}`;
}

/**
 * Reserves a new save slot id for a fresh colony. The slot appears in the load list after the first autosave.
 */
export function ensureActiveSaveSlotForNewGame(): string {
  const slotId = crypto.randomUUID();
  setActiveSaveSlotSession(slotId);
  return slotId;
}

export function setActiveSaveSlotSession(slotId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_SAVE_SLOT_SESSION_KEY, slotId);
  } catch {
    /* ignore */
  }
}

function getActiveSaveSlotIdFromSession(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_SAVE_SLOT_SESSION_KEY);
  } catch {
    return null;
  }
}

function upsertIndexEntryForSlot(
  slotId: string,
  slotLabel: string,
  savedAtIso: string,
): void {
  const index = readSaveIndex();
  const i = index.slots.findIndex((s) => s.slotId === slotId);
  const entry: SaveIndexEntry = { slotId, slotLabel, savedAtIso };
  const slots =
    i >= 0
      ? index.slots.map((s) => (s.slotId === slotId ? entry : s))
      : [...index.slots, entry];
  writeSaveIndex({ formatVersion: SAVE_INDEX_FORMAT_VERSION, slots });
}

/**
 * Loads the colony JSON for the current session's slot (Continue / loaded game).
 */
export function readColonySaveFromStorage(): ColonySaveV1 | null {
  const slotId = getActiveSaveSlotIdFromSession();
  if (!slotId) {
    return null;
  }
  return getColonySaveForSlot(slotId);
}

export function writeColonySaveToStorage(data: ColonySaveV1): void {
  let slotId = getActiveSaveSlotIdFromSession();
  if (!slotId) {
    slotId = crypto.randomUUID();
    setActiveSaveSlotSession(slotId);
  }
  const index = readSaveIndex();
  const existing = index.slots.find((s) => s.slotId === slotId);
  const slotLabel = existing?.slotLabel ?? nextDefaultSlotLabel(index.slots);
  localStorage.setItem(slotStorageKey(slotId), JSON.stringify(data));
  upsertIndexEntryForSlot(slotId, slotLabel, data.savedAtIso);
}

/**
 * Removes one save slot (storage + index entry).
 */
export function deleteSaveSlot(slotId: string): void {
  try {
    localStorage.removeItem(slotStorageKey(slotId));
  } catch {
    /* ignore */
  }
  const index = readSaveIndex();
  writeSaveIndex({
    formatVersion: SAVE_INDEX_FORMAT_VERSION,
    slots: index.slots.filter((s) => s.slotId !== slotId),
  });
}

/**
 * Clears every save slot and the legacy key (for tests or full reset).
 */
export function clearAllColonySavesFromStorage(): void {
  try {
    const index = readSaveIndex();
    for (const s of index.slots) {
      localStorage.removeItem(slotStorageKey(s.slotId));
    }
    localStorage.removeItem(SAVE_INDEX_KEY);
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer {@link clearAllColonySavesFromStorage} or {@link deleteSaveSlot}. */
export function clearColonySaveFromStorage(): void {
  clearAllColonySavesFromStorage();
}
