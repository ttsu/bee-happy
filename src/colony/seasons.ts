/**
 * Colony calendar: four seasons of equal length. Default year = 4 × {@link SEASON_LENGTH_DAYS} colony days.
 * Day 1 is Spring day 1.
 */

export type Season = "Spring" | "Summer" | "Fall" | "Winter";

/** Days per season (Spring, Summer, Fall, Winter) for the default calendar. */
export const SEASON_LENGTH_DAYS = 15;

/** Default full seasonal cycle length in colony days (four seasons × {@link SEASON_LENGTH_DAYS}). */
export const DAYS_PER_YEAR = SEASON_LENGTH_DAYS * 4;

const SEASONS_IN_ORDER: readonly Season[] = ["Spring", "Summer", "Fall", "Winter"];

/** Emoji prefix for HUD and other user-facing season labels. */
const SEASON_EMOJI: Readonly<Record<Season, string>> = {
  Spring: "🌸",
  Summer: "☀️",
  Fall: "🍂",
  Winter: "❄️",
};

/**
 * Returns a display string for the season (emoji + name), e.g. `"☀️ Summer"`.
 *
 * @param season - The canonical season id.
 */
export const getSeasonDisplayLabel = (season: Season): string =>
  `${SEASON_EMOJI[season]} ${season}`;

export interface SeasonInfo {
  /** Current season name. */
  readonly season: Season;
  /** 1-based day within the current season. */
  readonly seasonDayOneBased: number;
  /** 0-based count of completed calendar years before this day. */
  readonly cycleIndex: number;
  /** 1-based day within the current calendar year. */
  readonly dayInCycle: number;
}

/**
 * Maps a 1-based colony calendar day to season and position within the year.
 *
 * @param colonyDayOneBased - Colony day from {@link ColonyTimeComponent} scale (1-based).
 * @param daysPerSeason - Length of each season in colony days (default {@link SEASON_LENGTH_DAYS}).
 */
export const getSeasonForColonyDay = (
  colonyDayOneBased: number,
  daysPerSeason: number = SEASON_LENGTH_DAYS,
): SeasonInfo => {
  const safe = Math.max(1, Math.floor(colonyDayOneBased));
  const dayIdx = safe - 1;
  const daysPerYear = Math.max(4, daysPerSeason * 4);
  const cycleIndex = Math.floor(dayIdx / daysPerYear);
  const dayInCycle = (dayIdx % daysPerYear) + 1;
  const seasonIndex = Math.floor((dayInCycle - 1) / daysPerSeason);
  const season = SEASONS_IN_ORDER[seasonIndex] ?? "Winter";
  const seasonDayOneBased = ((dayInCycle - 1) % daysPerSeason) + 1;
  return { season, seasonDayOneBased, cycleIndex, dayInCycle };
};
