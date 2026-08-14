import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossedCalendarYear, resolveYearEndAction } from "./season-year-boundary.ts";

describe("crossedCalendarYear", () => {
  const daysPerYear = 60;

  it("detects the first day of a new calendar year", () => {
    assert.equal(crossedCalendarYear(daysPerYear, daysPerYear + 1, daysPerYear), true);
  });

  it("ignores the first colony day and same-day updates", () => {
    assert.equal(crossedCalendarYear(0, 1, daysPerYear), false);
    assert.equal(crossedCalendarYear(10, 10, daysPerYear), false);
  });
});

describe("resolveYearEndAction", () => {
  it("triggers mandatory succession every year when lineage is enabled", () => {
    assert.deepEqual(resolveYearEndAction(true), {
      type: "mandatorySuccession",
      reason: "queenAgedOut",
    });
  });

  it("opens the year review when lineage is disabled", () => {
    assert.deepEqual(resolveYearEndAction(false), { type: "yearReview" });
  });
});
