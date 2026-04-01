import type { ColonyRuntime } from "./colony/colony-runtime";

let colony: ColonyRuntime | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const l of listeners) {
    l();
  }
};

/**
 * Subscribe to {@link setColonyBridge} updates (for React `useSyncExternalStore`).
 */
export const subscribeColonyBridge = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
};

/**
 * Stores the active {@link ColonyRuntime} after the scene initializes (for React / UI).
 */
export const setColonyBridge = (c: ColonyRuntime): void => {
  colony = c;
  notify();
};

export const getColonyBridge = (): ColonyRuntime | null => colony;
