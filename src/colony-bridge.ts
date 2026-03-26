import type { ColonyRuntime } from "./colony/colony-runtime";

let colony: ColonyRuntime | null = null;

/**
 * Stores the active {@link ColonyRuntime} after the scene initializes (for React / UI).
 */
export const setColonyBridge = (c: ColonyRuntime): void => {
  colony = c;
};

export const getColonyBridge = (): ColonyRuntime | null => colony;
