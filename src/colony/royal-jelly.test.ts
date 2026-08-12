import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { royalJellyFromHappiness } from "./royal-jelly.ts";

describe("royalJellyFromHappiness", () => {
  it("rounds happiness percent of the configured rate", () => {
    assert.equal(royalJellyFromHappiness(80, 15), 12);
    assert.equal(royalJellyFromHappiness(67, 10), 7);
    assert.equal(royalJellyFromHappiness(100, 15), 15);
  });

  it("returns zero for zero happiness", () => {
    assert.equal(royalJellyFromHappiness(0, 15), 0);
  });
});
