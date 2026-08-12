import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accrueRoyalJellyFromBuffer,
  royalJellyPerDayFromHappiness,
} from "./royal-jelly.ts";

describe("royalJellyPerDayFromHappiness", () => {
  it("returns a fractional daily rate", () => {
    assert.equal(royalJellyPerDayFromHappiness(80, 1), 0.8);
    assert.equal(royalJellyPerDayFromHappiness(100, 1), 1);
    assert.equal(royalJellyPerDayFromHappiness(0, 1), 0);
  });
});

describe("accrueRoyalJellyFromBuffer", () => {
  it("mints whole jelly when the buffer crosses integers", () => {
    const first = accrueRoyalJellyFromBuffer(0, 0, 0.8, 1);
    assert.equal(first.stored, 0);
    assert.equal(first.buffer, 0.8);

    const second = accrueRoyalJellyFromBuffer(first.stored, first.buffer, 0.8, 1);
    assert.equal(second.stored, 1);
    assert.ok(Math.abs(second.buffer - 0.6) < 1e-9);
  });

  it("accrues multiple days in one step", () => {
    const result = accrueRoyalJellyFromBuffer(0, 0, 0.8, 10);
    assert.equal(result.stored, 8);
    assert.equal(result.buffer, 0);
  });
});
