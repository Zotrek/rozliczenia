import { describe, expect, it } from "vitest";
import { compareSheetDate, isOnOrBefore, parseSheetDate } from "./sheetDate.js";

describe("parseSheetDate", () => {
  it("test_parseSheetDate_dd_mm_yyyy_ok", () => {
    expect(parseSheetDate("10.09.2026")).toEqual({ year: 2026, month: 9, day: 10 });
  });

  it("test_parseSheetDate_iso_rejected", () => {
    expect(() => parseSheetDate("2026-09-10")).toThrow(/dd\.mm\.yyyy/);
  });
});

describe("compareSheetDate", () => {
  it("test_compareSheetDate_empty_older_than_any_written", () => {
    expect(compareSheetDate("", "10.09.2026")).toBeLessThan(0);
    expect(compareSheetDate("10.09.2026", "")).toBeGreaterThan(0);
  });

  it("test_compareSheetDate_09_10_2026_after_10_09_2026", () => {
    expect(compareSheetDate("09.10.2026", "10.09.2026")).toBeGreaterThan(0);
  });

  it("test_compareSheetDate_calendar_not_text_sort", () => {
    expect(compareSheetDate("01.02.2026", "01.10.2025")).toBeGreaterThan(0);
  });
});

describe("isOnOrBefore", () => {
  it("test_isOnOrBefore_empty_validFrom_always_true", () => {
    expect(isOnOrBefore("", "10.09.2026")).toBe(true);
  });

  it("test_isOnOrBefore_same_day_and_earlier_true_later_false", () => {
    expect(isOnOrBefore("10.09.2026", "10.09.2026")).toBe(true);
    expect(isOnOrBefore("09.09.2026", "10.09.2026")).toBe(true);
    expect(isOnOrBefore("11.09.2026", "10.09.2026")).toBe(false);
  });
});
