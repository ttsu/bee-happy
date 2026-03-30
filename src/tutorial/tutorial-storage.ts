/** Persisted when the player finishes or skips the interactive tutorial. */
export const TUTORIAL_STORAGE_KEY = "bee-happy-tutorial-v1";

export type TutorialStorageValue = "done" | "skipped";

/**
 * Reads the stored tutorial completion flag, or null if unset.
 */
export const readTutorialStorage = (): TutorialStorageValue | null => {
  try {
    const v = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (v === "done" || v === "skipped") {
      return v;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Persists that the player completed or skipped the tutorial.
 */
export const writeTutorialStorage = (value: TutorialStorageValue): void => {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, value);
  } catch {
    /* quota / private mode */
  }
};
