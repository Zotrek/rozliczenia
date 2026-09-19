import { describe, expect, it } from "vitest";
import { costPerBag, divRoundHalfUp, toGrosze } from "./money.js";

describe("divRoundHalfUp", () => {
  it("test_divRoundHalfUp_100zl_three_shops_3333_grosze", () => {
    expect(divRoundHalfUp(10_000, 3)).toBe(3_333);
  });

  it("test_divRoundHalfUp_three_shares_sum_9999_not_10000", () => {
    const share = divRoundHalfUp(10_000, 3);
    expect(share * 3).toBe(9_999);
  });

  it("test_divRoundHalfUp_digit5_rounds_up", () => {
    expect(divRoundHalfUp(1, 2)).toBe(1);
  });

  it("test_divRoundHalfUp_below_half_rounds_down", () => {
    expect(divRoundHalfUp(1, 3)).toBe(0);
  });
});

describe("costPerBag", () => {
  it("test_costPerBag_empty_count_divides_by_1", () => {
    expect(costPerBag(2_000, null)).toBe(2_000);
  });

  it("test_costPerBag_zero_count_divides_by_1", () => {
    expect(costPerBag(15_000, 0)).toBe(15_000);
  });
});

describe("toGrosze", () => {
  it("test_toGrosze_whole_zloty_and_33_33", () => {
    expect(toGrosze(20)).toBe(2_000);
    expect(toGrosze(33.33)).toBe(3_333);
    expect(toGrosze(0)).toBe(0);
  });
});
