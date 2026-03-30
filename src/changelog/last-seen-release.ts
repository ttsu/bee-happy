import { CURRENT_RELEASE_ID } from "./player-changelog";

export const LAST_SEEN_RELEASE_STORAGE_KEY = "bee-happy-last-seen-release";

/**
 * Reads the last release id the player acknowledged on this device, or `null` if never set.
 */
export const readLastSeenReleaseId = (): string | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const v = localStorage.getItem(LAST_SEEN_RELEASE_STORAGE_KEY);
    return v === null || v === "" ? null : v;
  } catch {
    return null;
  }
};

/**
 * Persists the last acknowledged player-facing release id.
 */
export const writeLastSeenReleaseId = (id: string): void => {
  try {
    localStorage.setItem(LAST_SEEN_RELEASE_STORAGE_KEY, id);
  } catch {
    // Quota or privacy mode — ignore
  }
};

/**
 * First-time visitors skip the What’s new modal; call when starting a game so the next deploy can show a diff.
 */
export const acknowledgeCurrentReleaseIfUnset = (): void => {
  if (readLastSeenReleaseId() === null) {
    writeLastSeenReleaseId(CURRENT_RELEASE_ID);
  }
};
