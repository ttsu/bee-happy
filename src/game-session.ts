/**
 * Session payload set when starting the Excalibur engine from the launch menu,
 * consumed once when {@link MyLevel} initializes (replaces static scene class state).
 */
export type PendingGameStart = {
  readonly loadSaveSlotId: string | null;
};

let pending: PendingGameStart | null = null;

export const setPendingGameStart = (payload: PendingGameStart): void => {
  pending = payload;
};

/**
 * Returns and clears the pending start payload (single consume per game start).
 */
export const takePendingGameStart = (): PendingGameStart | null => {
  const p = pending;
  pending = null;
  return p;
};
