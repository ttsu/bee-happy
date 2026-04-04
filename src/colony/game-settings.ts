import { z } from "zod";
import { SEASON_LENGTH_DAYS } from "./seasons";

export const DAYS_PER_SEASON_MIN = 5;
export const DAYS_PER_SEASON_MAX = 40;
export const STARTING_WORKERS_MIN = 2;
export const STARTING_WORKERS_MAX = 50;

/** Slider / persisted shape for colony game rules. */
export const gameSettingsSchema = z.object({
  intrudersEnabled: z.boolean(),
  lineageSystemEnabled: z.boolean(),
  daysPerSeason: z.number().int().min(DAYS_PER_SEASON_MIN).max(DAYS_PER_SEASON_MAX),
  startingWorkers: z.number().int().min(STARTING_WORKERS_MIN).max(STARTING_WORKERS_MAX),
});

export type GameSettings = z.infer<typeof gameSettingsSchema>;

/** Options chosen on the launch menu for a new colony (same shape as {@link GameSettings}). */
export type NewGameOptions = GameSettings;

export const DEFAULT_NEW_GAME_SETTINGS: GameSettings = {
  intrudersEnabled: false,
  lineageSystemEnabled: false,
  daysPerSeason: SEASON_LENGTH_DAYS,
  startingWorkers: 2,
};

/** Builder / casual: intruders and lineage off; other options at defaults. */
export const BUILDER_MODE_CASUAL_SETTINGS: GameSettings = {
  ...DEFAULT_NEW_GAME_SETTINGS,
};

/** Normal: intruders and lineage on; other options at defaults. */
export const NORMAL_MODE_SETTINGS: GameSettings = {
  ...DEFAULT_NEW_GAME_SETTINGS,
  intrudersEnabled: true,
  lineageSystemEnabled: true,
};

/**
 * Merges optional save payload with defaults for saves that predate `gameSettings`.
 * Missing `lineageSystemEnabled` defaults to **true** (legacy behavior).
 */
export function gameSettingsFromSave(
  raw: Partial<GameSettings> | undefined,
): GameSettings {
  if (!raw) {
    return {
      ...DEFAULT_NEW_GAME_SETTINGS,
      lineageSystemEnabled: true,
    };
  }
  const parsed = gameSettingsSchema.safeParse({
    intrudersEnabled: raw.intrudersEnabled ?? false,
    lineageSystemEnabled: raw.lineageSystemEnabled ?? true,
    daysPerSeason: raw.daysPerSeason ?? SEASON_LENGTH_DAYS,
    startingWorkers: raw.startingWorkers ?? 2,
  });
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_NEW_GAME_SETTINGS, lineageSystemEnabled: true };
}

export function daysPerYearFromSeasonLength(daysPerSeason: number): number {
  return daysPerSeason * 4;
}
