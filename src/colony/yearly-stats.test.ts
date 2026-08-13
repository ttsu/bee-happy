import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceColonyYear,
  maybeAdvanceYearAfterSuccession,
  type YearlyStatsFields,
} from "./yearly-stats.ts";

const createYearly = (over: Partial<YearlyStatsFields> = {}): YearlyStatsFields => ({
  yearNumber: 1,
  isYearReviewOpen: false,
  honeyProcessedTotal: 0,
  nectarCollectedTotal: 0,
  pollenCollectedTotal: 0,
  beesHatchedTotal: 0,
  happyBeeSecondsTotal: 0,
  remainingBeesAtYearEnd: 0,
  ...over,
});

describe("advanceColonyYear", () => {
  it("increments yearNumber and resets yearly counters", () => {
    const yearly = createYearly({
      yearNumber: 2,
      honeyProcessedTotal: 10,
      nectarCollectedTotal: 20,
      pollenCollectedTotal: 30,
      beesHatchedTotal: 4,
      happyBeeSecondsTotal: 500,
      remainingBeesAtYearEnd: 12,
    });

    advanceColonyYear(yearly);

    assert.equal(yearly.yearNumber, 3);
    assert.equal(yearly.honeyProcessedTotal, 0);
    assert.equal(yearly.nectarCollectedTotal, 0);
    assert.equal(yearly.pollenCollectedTotal, 0);
    assert.equal(yearly.beesHatchedTotal, 0);
    assert.equal(yearly.happyBeeSecondsTotal, 0);
    assert.equal(yearly.remainingBeesAtYearEnd, 0);
  });
});

describe("maybeAdvanceYearAfterSuccession", () => {
  it("advances the calendar when the reign ended at a year boundary", () => {
    const yearly = createYearly({ yearNumber: 1, honeyProcessedTotal: 5 });

    maybeAdvanceYearAfterSuccession(yearly, "queenAgedOut");

    assert.equal(yearly.yearNumber, 2);
    assert.equal(yearly.honeyProcessedTotal, 0);
    assert.equal(yearly.isYearReviewOpen, false);
  });

  it("does not advance the calendar for mid-year starvation", () => {
    const yearly = createYearly({ yearNumber: 1, honeyProcessedTotal: 5 });

    maybeAdvanceYearAfterSuccession(yearly, "queenStarved");

    assert.equal(yearly.yearNumber, 1);
    assert.equal(yearly.honeyProcessedTotal, 5);
  });
});
