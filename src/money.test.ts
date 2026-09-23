import { describe, expect, it } from "vitest";
import { costPerBag, divRoundHalfUp, mulGrosze, toGrosze } from "./money.js";

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

describe("mulGrosze", () => {
  it("test_mulGrosze_integer_count_multiplies_unit", () => {
    expect(mulGrosze(3, 1_000)).toBe(3_000);
    expect(mulGrosze(0, 1_000)).toBe(0);
    expect(mulGrosze(3, 0)).toBe(0);
  });

  it("test_mulGrosze_fractional_count_rounds_half_up", () => {
    expect(mulGrosze(0.5, 1)).toBe(1);
    expect(mulGrosze(1.5, 1_000)).toBe(1_500);
  });
});
