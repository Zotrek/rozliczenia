import { describe, expect, it } from "vitest";
import { resolveRate } from "./rates.js";
import type { RateRow } from "./types.js";

function rate(over: Partial<RateRow> & Pick<RateRow, "shop" | "contractor">): RateRow {
  return {
    pickupAmount: 2_000,
    bagAmount: 100,
    validFrom: "",
    ...over,
  };
}

describe("resolveRate", () => {
  it("test_resolveRate_no_matching_pair_is_none", () => {
    expect(resolveRate([rate({ shop: "A", contractor: "gpw" })], "B", "gpw", "10.09.2026")).toEqual({
      kind: "none",
    });
    expect(resolveRate([rate({ shop: "A", contractor: "gpw" })], "A", "inny", "10.09.2026")).toEqual({
      kind: "none",
    });
  });

  it("test_resolveRate_empty_validFrom_covers_any_pickup", () => {
    expect(resolveRate([rate({ shop: "A", contractor: "gpw", validFrom: "" })], "A", "gpw", "01.01.2020")).toEqual({
      kind: "ok",
      pickupAmount: 2_000,
      bagAmount: 100,
    });
  });

  it("test_resolveRate_later_validFrom_on_or_before_pickup_wins", () => {
    const rates = [
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2025", pickupAmount: 1_000, bagAmount: 10 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "01.06.2026", pickupAmount: 3_000, bagAmount: 50 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "01.12.2026", pickupAmount: 9_000, bagAmount: 90 }),
    ];
    expect(resolveRate(rates, "A", "gpw", "15.06.2026")).toEqual({
      kind: "ok",
      pickupAmount: 3_000,
      bagAmount: 50,
    });
  });

  it("test_resolveRate_validFrom_after_pickup_is_ignored", () => {
    const rates = [
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2026", pickupAmount: 1_000 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "20.09.2026", pickupAmount: 9_000 }),
    ];
    expect(resolveRate(rates, "A", "gpw", "10.09.2026")).toEqual({
      kind: "ok",
      pickupAmount: 1_000,
      bagAmount: 100,
    });
  });

  it("test_resolveRate_same_validFrom_two_rows_is_tie_not_zero", () => {
    const rates = [
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2026", pickupAmount: 1_000, bagAmount: 10 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2026", pickupAmount: 2_000, bagAmount: 20 }),
    ];
    const resolved = resolveRate(rates, "A", "gpw", "10.09.2026");
    expect(resolved.kind).toBe("tie");
    if (resolved.kind === "tie") {
      expect(resolved.tie.shop).toBe("A");
      expect(resolved.tie.contractor).toBe("gpw");
      expect(resolved.tie.validFrom).toBe("01.01.2026");
      expect(resolved.tie.candidates).toHaveLength(2);
      expect(resolved.tie.candidates.map((c) => c.index)).toEqual([0, 1]);
      expect(resolved.tie.candidates.map((c) => c.pickupAmount)).toEqual([1_000, 2_000]);
    }
  });

  it("test_resolveRate_older_duplicate_does_not_block_later_unique", () => {
    const rates = [
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2025", pickupAmount: 1_000 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "01.01.2025", pickupAmount: 1_500 }),
      rate({ shop: "A", contractor: "gpw", validFrom: "01.06.2026", pickupAmount: 3_000, bagAmount: null }),
    ];
    expect(resolveRate(rates, "A", "gpw", "10.09.2026")).toEqual({
      kind: "ok",
      pickupAmount: 3_000,
      bagAmount: null,
    });
  });

  it("test_resolveRate_null_amounts_stay_null_on_ok", () => {
    expect(
      resolveRate(
        [rate({ shop: "A", contractor: "gpw", pickupAmount: null, bagAmount: null })],
        "A",
        "gpw",
        "10.09.2026",
      ),
    ).toEqual({ kind: "ok", pickupAmount: null, bagAmount: null });
  });

  it("test_resolveRate_invalid_pickup_date_throws", () => {
    expect(() => resolveRate([rate({ shop: "A", contractor: "gpw" })], "A", "gpw", "2026-09-10")).toThrow(
      /dd\.mm\.yyyy/,
    );
  });
});
