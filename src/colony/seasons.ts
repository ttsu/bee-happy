/**
 * Colony calendar: four seasons of equal length, repeating every 60 colony days.
 * Day 1 is Spring day 1.
 */

export type Season = "Spring" | "Summer" | "Fall" | "Winter";

/** Days per season (Spring, Summer, Fall, Winter). */
export const SEASON_LENGTH_DAYS = 15;

/** Full seasonal cycle length in colony days. */
export const DAYS_PER_YEAR = 60;

const SEASONS_IN_ORDER: readonly Season[] = [
  "Spring",
  "Summer",
  "Fall",
  "Winter",
];

export interface SeasonInfo {
  /** Current season name. */
  readonly season: Season;
  /** 1-based day within the current season (1..{@link SEASON_LENGTH_DAYS}). */
  readonly seasonDayOneBased: number;
  /** 0-based count of completed 60-day years before this day. */
  readonly cycleIndex: number;
  /** 1-based day within the current 60-day year (1..{@link DAYS_PER_YEAR}). */
  readonly dayInCycle: number;
}

/**
 * Maps a 1-based colony calendar day to season and position within the year.
 *
 * @param colonyDayOneBased - Colony day from {@link ColonyTimeComponent} scale (1-based).
 */
export const getSeasonForColonyDay = (
  colonyDayOneBased: number,
): SeasonInfo => {
  const safe = Math.max(1, Math.floor(colonyDayOneBased));
  const dayIdx = safe - 1;
  const cycleIndex = Math.floor(dayIdx / DAYS_PER_YEAR);
  const dayInCycle = (dayIdx % DAYS_PER_YEAR) + 1;
  const seasonIndex = Math.floor((dayInCycle - 1) / SEASON_LENGTH_DAYS);
  const season = SEASONS_IN_ORDER[seasonIndex] ?? "Winter";
  const seasonDayOneBased = ((dayInCycle - 1) % SEASON_LENGTH_DAYS) + 1;
  return { season, seasonDayOneBased, cycleIndex, dayInCycle };
};
