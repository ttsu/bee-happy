import type { SuccessionReason } from "./meta/meta-progress";

/** Mutable yearly stats fields advanced at year boundaries. */
export type YearlyStatsFields = {
  yearNumber: number;
  isYearReviewOpen: boolean;
  honeyProcessedTotal: number;
  nectarCollectedTotal: number;
  pollenCollectedTotal: number;
  beesHatchedTotal: number;
  happyBeeSecondsTotal: number;
  remainingBeesAtYearEnd: number;
};

/** Increments the calendar year and resets per-year counters. */
export const advanceColonyYear = (yearly: YearlyStatsFields): void => {
  yearly.yearNumber += 1;
  yearly.honeyProcessedTotal = 0;
  yearly.nectarCollectedTotal = 0;
  yearly.pollenCollectedTotal = 0;
  yearly.beesHatchedTotal = 0;
  yearly.happyBeeSecondsTotal = 0;
  yearly.remainingBeesAtYearEnd = 0;
};

/** Advances the calendar when succession ends a reign at a year boundary. */
export const maybeAdvanceYearAfterSuccession = (
  yearly: YearlyStatsFields,
  reason: SuccessionReason,
): void => {
  if (reason !== "queenAgedOut") {
    return;
  }
  yearly.isYearReviewOpen = false;
  advanceColonyYear(yearly);
};
