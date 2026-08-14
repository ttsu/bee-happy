/** Pure year-boundary helpers (no Excalibur imports — safe for Node unit tests). */

export type YearEndAction =
  | { readonly type: "yearReview" }
  | { readonly type: "mandatorySuccession"; readonly reason: "queenAgedOut" };

export const crossedCalendarYear = (
  prevColonyDay: number,
  currentColonyDay: number,
  daysPerYear: number,
): boolean =>
  prevColonyDay !== 0 &&
  prevColonyDay % daysPerYear === 0 &&
  currentColonyDay > prevColonyDay;

export const resolveYearEndAction = (lineageSystemEnabled: boolean): YearEndAction =>
  lineageSystemEnabled
    ? { type: "mandatorySuccession", reason: "queenAgedOut" }
    : { type: "yearReview" };
