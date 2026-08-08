/** Whether the player is in an active colony session (in-game HUD). */
let gameSessionActive = false;

let saveBeforeReload: (() => void) | null = null;

export const setGameSessionActive = (active: boolean): void => {
  gameSessionActive = active;
};

export const isGameSessionActive = (): boolean => gameSessionActive;

export const registerSaveBeforeReload = (fn: (() => void) | null): void => {
  saveBeforeReload = fn;
};

export const getSaveBeforeReload = (): (() => void) | null => saveBeforeReload;

/** Launch menu / boot: apply immediately; in-game: show a prompt first. */
export const shouldAutoApplyUpdate = (): boolean => !gameSessionActive;
