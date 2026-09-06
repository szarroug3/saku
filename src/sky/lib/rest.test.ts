import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCountdown, restLeft, restMinutes } from "./rest";

describe("the rest between rounds", () => {
  it("is the first number before round two and the second after", () => {
    assert.equal(restMinutes(2, 5, 10), 5);
    assert.equal(restMinutes(3, 5, 10), 10);
    assert.equal(restMinutes(4, 5, 10), 10);
  });

  it("counts down and never goes below zero", () => {
    assert.equal(restLeft(1000, 400), 600);
    assert.equal(restLeft(1000, 1000), 0);
    assert.equal(restLeft(1000, 5000), 0);
  });

  it("formats minutes and seconds, rounding a part second up", () => {
    assert.equal(formatCountdown(198_000), "3:18");
    assert.equal(formatCountdown(59_001), "1:00");
    assert.equal(formatCountdown(0), "0:00");
  });
});
