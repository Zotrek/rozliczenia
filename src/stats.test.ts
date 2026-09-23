import { describe, expect, it } from "vitest";
import { settle } from "./engine.js";
import type { SettlementRateRow } from "./search.js";
import type { CalendarDate } from "./sheetDate.js";
import {
  aggregateAvgQ,
  aggregateBacklog,
  aggregateBagsOverTime,
  aggregateContractorRanks,
  aggregateCostsOverTime,
  aggregatePeriodActivity,
  aggregateQRanks,
  aggregateRateGaps,
  aggregateSettled,
  calendarMonthPeriod,
  calendarQuarterPeriod,
  currentMonthPeriod,
  currentQuarterPeriod,
  exactPeriod,
  findRateTiesInBase,
  formatSheetDate,
  inSheetDateRange,
  listZeroBagPickups,
  monthOptionLabel,
  previousQuarterOptions,
  previousQuarterPeriod,
  quarterOptionLabel,
  rateGapLabel,
  statsPeriodKindLabel,
  timeBucketGranularity,
  type StatsRow,
} from "./stats.js";

const TODAY: CalendarDate = { year: 2026, month: 9, day: 23 };

function statsRow(over: Partial<StatsRow> & Pick<StatsRow, "sheetRow">): StatsRow {
  return {
    transportNumber: String(over.sheetRow),
    address: "Sklepowa 1",
    shopName: "Sklep",
    pickupDate: "18.09.2026",
    contractor: "gpw",
    bagCount: 1,
    routeName: "",
    routeRate: null,
    pickupRate: 2_000,
    bagRate: 1_000,
    settled: false,
    happened: true,
    receptionCost: null,
    costPerBag: null,
    ...over,
  };
}

function rate(
  over: Partial<SettlementRateRow> & Pick<SettlementRateRow, "sheetRow" | "shop">,
): SettlementRateRow {
  return {
    contractor: "gpw",
    pickupAmount: 2_000,
    bagAmount: 1_000,
    validFrom: "",
    ...over,
  };
}

describe("formatSheetDate / periods", () => {
  it("test_formatSheetDate_pads_day_and_month", () => {
    expect(formatSheetDate({ year: 2026, month: 9, day: 1 })).toBe("01.09.2026");
    expect(formatSheetDate({ year: 2026, month: 12, day: 31 })).toBe("31.12.2026");
  });

  it("test_currentMonthPeriod_first_of_month_to_today_inclusive", () => {
    expect(currentMonthPeriod(TODAY)).toEqual({ from: "01.09.2026", to: "23.09.2026" });
  });

  it("test_currentMonthPeriod_injectable_today_changes_range", () => {
    expect(currentMonthPeriod({ year: 2026, month: 2, day: 5 })).toEqual({
      from: "01.02.2026",
      to: "05.02.2026",
    });
  });

  it("test_calendarMonthPeriod_full_month_including_31", () => {
    expect(calendarMonthPeriod(2026, 8)).toEqual({ from: "01.08.2026", to: "31.08.2026" });
  });

  it("test_calendarMonthPeriod_february_non_leap_and_leap", () => {
    expect(calendarMonthPeriod(2026, 2)).toEqual({ from: "01.02.2026", to: "28.02.2026" });
    expect(calendarMonthPeriod(2024, 2)).toEqual({ from: "01.02.2024", to: "29.02.2024" });
  });

  it("test_previousQuarterPeriod_september_is_q2", () => {
    expect(previousQuarterPeriod(TODAY)).toEqual({ from: "01.04.2026", to: "30.06.2026" });
  });

  it("test_previousQuarterPeriod_january_is_prior_year_q4", () => {
    expect(previousQuarterPeriod({ year: 2026, month: 1, day: 15 })).toEqual({
      from: "01.10.2025",
      to: "31.12.2025",
    });
  });

  it("test_previousQuarterPeriod_april_is_q1", () => {
    expect(previousQuarterPeriod({ year: 2026, month: 4, day: 1 })).toEqual({
      from: "01.01.2026",
      to: "31.03.2026",
    });
  });

  it("test_currentQuarterPeriod_start_of_quarter_to_today", () => {
    expect(currentQuarterPeriod(TODAY)).toEqual({ from: "01.07.2026", to: "23.09.2026" });
    expect(currentQuarterPeriod({ year: 2026, month: 2, day: 5 })).toEqual({
      from: "01.01.2026",
      to: "05.02.2026",
    });
  });

  it("test_calendarQuarterPeriod_full_q2", () => {
    expect(calendarQuarterPeriod(2026, 2)).toEqual({ from: "01.04.2026", to: "30.06.2026" });
  });

  it("test_previousQuarterOptions_starts_from_previous_quarter", () => {
    expect(previousQuarterOptions(TODAY, 3)).toEqual([
      { year: 2026, quarter: 2, value: "2026-Q2", label: "II kwartał 2026" },
      { year: 2026, quarter: 1, value: "2026-Q1", label: "I kwartał 2026" },
      { year: 2025, quarter: 4, value: "2025-Q4", label: "IV kwartał 2025" },
    ]);
  });

  it("test_exactPeriod_iso_inclusive_range", () => {
    expect(exactPeriod("2026-09-01", "2026-09-23")).toEqual({
      from: "01.09.2026",
      to: "23.09.2026",
    });
  });

  it("test_exactPeriod_sheet_dates_ok", () => {
    expect(exactPeriod("01.09.2026", "23.09.2026")).toEqual({
      from: "01.09.2026",
      to: "23.09.2026",
    });
  });

  it("test_exactPeriod_invalid_or_reversed_returns_null", () => {
    expect(exactPeriod("2026-02-30", "2026-03-01")).toBeNull();
    expect(exactPeriod("2026-09-23", "2026-09-01")).toBeNull();
    expect(exactPeriod("", "2026-09-01")).toBeNull();
  });

  it("test_inSheetDateRange_inclusive_endpoints", () => {
    const range = { from: "01.09.2026", to: "23.09.2026" };
    expect(inSheetDateRange("01.09.2026", range)).toBe(true);
    expect(inSheetDateRange("23.09.2026", range)).toBe(true);
    expect(inSheetDateRange("31.08.2026", range)).toBe(false);
    expect(inSheetDateRange("24.09.2026", range)).toBe(false);
  });
});

describe("aggregateBacklog", () => {
  it("test_aggregateBacklog_unsettled_happened_count_and_settle_estimate", () => {
    const rows = [
      statsRow({ sheetRow: 2, pickupRate: 2_000, bagRate: 1_000, bagCount: 1 }),
      statsRow({ sheetRow: 3, address: "Inna 2", pickupRate: 3_000, bagRate: 0, bagCount: 0 }),
    ];
    const expected = settle({
      rows: rows.map(({ settled: _s, happened: _h, receptionCost: _p, costPerBag: _q, ...row }) => row),
      rates: [],
      screenByRow: {},
    }).total;
    expect(aggregateBacklog(rows)).toEqual({ count: 2, estimate: expected });
    expect(expected).toBe(6_000);
  });

  it("test_aggregateBacklog_excludes_settled_and_not_happened", () => {
    const rows = [
      statsRow({ sheetRow: 2 }),
      statsRow({ sheetRow: 3, settled: true, receptionCost: 5_000, costPerBag: 5_000 }),
      statsRow({ sheetRow: 4, happened: false }),
    ];
    expect(aggregateBacklog(rows).count).toBe(1);
  });

  it("test_aggregateBacklog_route_count_is_rows_estimate_route_once", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        transportNumber: "P1",
        address: "A 1",
        routeName: "trasa",
        routeRate: 15_000,
        bagCount: 4,
        pickupRate: null,
        bagRate: 1_000,
      }),
      statsRow({
        sheetRow: 3,
        transportNumber: "P2",
        address: "B 2",
        routeName: "trasa",
        routeRate: 15_000,
        bagCount: 0,
        pickupRate: null,
        bagRate: 1_000,
      }),
    ];
    const result = aggregateBacklog(rows);
    expect(result.count).toBe(2);
    expect(result.estimate).toBe(19_000);
  });

  it("test_aggregateBacklog_contractor_filter", () => {
    const rows = [
      statsRow({ sheetRow: 2, contractor: "gpw" }),
      statsRow({ sheetRow: 3, contractor: "blue", address: "X" }),
    ];
    expect(aggregateBacklog(rows, "gpw").count).toBe(1);
    expect(aggregateBacklog(rows).count).toBe(2);
  });
});

describe("aggregateSettled", () => {
  const range = { from: "01.09.2026", to: "23.09.2026" };

  it("test_aggregateSettled_sums_P_in_period_happened_only", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        happened: true,
        pickupDate: "10.09.2026",
        receptionCost: 3_000,
        costPerBag: 3_000,
      }),
      statsRow({
        sheetRow: 3,
        settled: true,
        happened: true,
        pickupDate: "15.09.2026",
        receptionCost: 5_000,
        costPerBag: 2_500,
        bagCount: 2,
      }),
      statsRow({
        sheetRow: 4,
        settled: true,
        happened: true,
        pickupDate: "31.08.2026",
        receptionCost: 9_000,
        costPerBag: 9_000,
      }),
      statsRow({
        sheetRow: 5,
        settled: true,
        happened: false,
        pickupDate: "12.09.2026",
        receptionCost: 1_000,
        costPerBag: null,
      }),
      statsRow({ sheetRow: 6, settled: false, pickupDate: "12.09.2026" }),
    ];
    expect(aggregateSettled(rows, { range })).toEqual({ count: 2, receptionSum: 8_000 });
  });

  it("test_aggregateSettled_contractor_filter", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        contractor: "gpw",
        receptionCost: 1_000,
        costPerBag: 1_000,
      }),
      statsRow({
        sheetRow: 3,
        settled: true,
        contractor: "blue",
        address: "X",
        receptionCost: 2_000,
        costPerBag: 2_000,
      }),
    ];
    expect(aggregateSettled(rows, { range, contractor: "gpw" })).toEqual({
      count: 1,
      receptionSum: 1_000,
    });
  });
});

describe("aggregateAvgQ / aggregateQRanks", () => {
  const range = { from: "01.09.2026", to: "23.09.2026" };

  it("test_aggregateAvgQ_settled_happened_bags_gt_zero_only", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        bagCount: 2,
        costPerBag: 2_000,
        receptionCost: 4_000,
      }),
      statsRow({
        sheetRow: 3,
        settled: true,
        bagCount: 4,
        costPerBag: 1_000,
        receptionCost: 4_000,
        address: "B",
      }),
      statsRow({
        sheetRow: 4,
        settled: true,
        bagCount: 0,
        costPerBag: 9_999,
        receptionCost: 9_999,
        address: "C",
      }),
      statsRow({
        sheetRow: 5,
        settled: true,
        bagCount: null,
        costPerBag: 9_999,
        receptionCost: 9_999,
        address: "D",
      }),
      statsRow({
        sheetRow: 6,
        settled: true,
        happened: false,
        bagCount: 3,
        costPerBag: 500,
        receptionCost: 0,
        address: "E",
      }),
      statsRow({ sheetRow: 7, settled: false, bagCount: 3, costPerBag: 100, address: "F" }),
    ];
    expect(aggregateAvgQ(rows, { range })).toEqual({ average: 1_500, sampleCount: 2 });
  });

  it("test_aggregateAvgQ_empty_pool_returns_null_average", () => {
    expect(aggregateAvgQ([], { range })).toEqual({ average: null, sampleCount: 0 });
  });

  it("test_aggregateQRanks_top5_expensive_desc_cheap_asc", () => {
    const rows = [10, 20, 30, 40, 50, 60, 70].map((q, i) =>
      statsRow({
        sheetRow: i + 2,
        settled: true,
        bagCount: 1,
        costPerBag: q * 100,
        receptionCost: q * 100,
        address: `Adres ${q}`,
        shopName: `Sklep ${q}`,
        pickupDate: `${String(i + 1).padStart(2, "0")}.09.2026`,
        contractor: "gpw",
      }),
    );
    const ranks = aggregateQRanks(rows, { range }, 5);
    expect(ranks.expensive.map((e) => e.costPerBag)).toEqual([7_000, 6_000, 5_000, 4_000, 3_000]);
    expect(ranks.cheap.map((e) => e.costPerBag)).toEqual([1_000, 2_000, 3_000, 4_000, 5_000]);
    expect(ranks.expensive[0]).toMatchObject({
      address: "Adres 70",
      shopName: "Sklep 70",
      contractor: "gpw",
      bagCount: 1,
    });
  });

  it("test_aggregateQRanks_fewer_than_topN_returns_all", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        bagCount: 1,
        costPerBag: 500,
        receptionCost: 500,
      }),
    ];
    const ranks = aggregateQRanks(rows, { range });
    expect(ranks.expensive).toHaveLength(1);
    expect(ranks.cheap).toHaveLength(1);
  });
});

describe("aggregateRateGaps / findRateTiesInBase", () => {
  it("test_findRateTiesInBase_same_pair_and_validFrom", () => {
    const rates = [
      rate({ sheetRow: 2, shop: "A 1", validFrom: "01.01.2026" }),
      rate({ sheetRow: 3, shop: "A 1", validFrom: "01.01.2026", pickupAmount: 3_000 }),
      rate({ sheetRow: 4, shop: "B 2", validFrom: "01.01.2026" }),
    ];
    const ties = findRateTiesInBase(rates);
    expect(ties).toHaveLength(1);
    expect(ties[0]).toMatchObject({ shop: "A 1", contractor: "gpw", validFrom: "01.01.2026" });
    expect(ties[0].candidates).toHaveLength(2);
  });

  it("test_aggregateRateGaps_empty_L_or_M_not_zero", () => {
    const rows = [
      statsRow({ sheetRow: 2, pickupRate: null, bagRate: 1_000, address: "Pusta L" }),
      statsRow({ sheetRow: 3, pickupRate: 2_000, bagRate: null, address: "Pusta M" }),
      statsRow({ sheetRow: 4, pickupRate: 0, bagRate: 0, address: "Zera" }),
      statsRow({ sheetRow: 5, settled: true, pickupRate: null, bagRate: null, address: "Rozliczony" }),
      statsRow({ sheetRow: 6, happened: false, pickupRate: null, bagRate: null, address: "Nieodbyty" }),
    ];
    const gaps = aggregateRateGaps(rows, []);
    expect(gaps.entries.map((e) => e.kind).sort()).toEqual(["emptyBag", "emptyPickup"]);
    expect(gaps.emptySnapshotCount).toBe(2);
    expect(gaps.tieCount).toBe(0);
    expect(gaps.total).toBe(2);
  });

  it("test_aggregateRateGaps_resolveRate_tie_on_unsettled_row", () => {
    const rows = [statsRow({ sheetRow: 2, address: "A 1", pickupDate: "18.09.2026" })];
    const rates = [
      rate({ sheetRow: 10, shop: "A 1", validFrom: "01.01.2026" }),
      rate({ sheetRow: 11, shop: "A 1", validFrom: "01.01.2026", bagAmount: 500 }),
    ];
    const gaps = aggregateRateGaps(rows, rates);
    expect(gaps.tieCount).toBe(1);
    expect(gaps.entries.some((e) => e.kind === "tie" && e.tie !== null)).toBe(true);
  });

  it("test_aggregateRateGaps_later_unique_validFrom_is_not_tie", () => {
    const rows = [statsRow({ sheetRow: 2, address: "A 1", pickupDate: "18.09.2026" })];
    const rates = [
      rate({ sheetRow: 10, shop: "A 1", validFrom: "01.01.2026" }),
      rate({ sheetRow: 11, shop: "A 1", validFrom: "01.01.2026", bagAmount: 500 }),
      rate({ sheetRow: 12, shop: "A 1", validFrom: "01.06.2026", bagAmount: 800 }),
    ];
    const gaps = aggregateRateGaps(rows, rates);
    expect(gaps.tieCount).toBe(0);
    expect(gaps.entries.filter((e) => e.kind === "tie")).toHaveLength(0);
  });

  it("test_aggregateRateGaps_contractor_filter", () => {
    const rows = [
      statsRow({ sheetRow: 2, contractor: "gpw", pickupRate: null }),
      statsRow({ sheetRow: 3, contractor: "blue", pickupRate: null, address: "X" }),
    ];
    expect(aggregateRateGaps(rows, [], "gpw").emptySnapshotCount).toBe(1);
  });
});

describe("aggregatePeriodActivity", () => {
  const range = { from: "01.09.2026", to: "23.09.2026" };

  it("test_aggregatePeriodActivity_happened_in_period_counts_rows_and_unique_addresses", () => {
    const rows = [
      statsRow({ sheetRow: 2, pickupDate: "10.09.2026", address: "A 1", settled: false }),
      statsRow({ sheetRow: 3, pickupDate: "12.09.2026", address: "A 1", settled: true }),
      statsRow({ sheetRow: 4, pickupDate: "15.09.2026", address: "B 2", settled: false }),
      statsRow({ sheetRow: 5, pickupDate: "31.08.2026", address: "C 3" }),
      statsRow({ sheetRow: 6, pickupDate: "10.09.2026", address: "D 4", happened: false }),
    ];
    expect(aggregatePeriodActivity(rows, { range })).toEqual({
      pickupCount: 3,
      uniqueShopCount: 2,
    });
  });

  it("test_aggregatePeriodActivity_contractor_filter", () => {
    const rows = [
      statsRow({ sheetRow: 2, contractor: "gpw", address: "A" }),
      statsRow({ sheetRow: 3, contractor: "blue", address: "B" }),
    ];
    expect(aggregatePeriodActivity(rows, { range, contractor: "gpw" })).toEqual({
      pickupCount: 1,
      uniqueShopCount: 1,
    });
  });
});

describe("timeBucketGranularity / series", () => {
  it("test_timeBucketGranularity_week_when_span_le_45_days_else_month", () => {
    expect(timeBucketGranularity({ from: "01.09.2026", to: "23.09.2026" })).toBe("week");
    expect(timeBucketGranularity({ from: "01.08.2026", to: "31.08.2026" })).toBe("week");
    expect(timeBucketGranularity({ from: "01.04.2026", to: "30.06.2026" })).toBe("month");
    expect(timeBucketGranularity({ from: "01.01.2026", to: "14.02.2026" })).toBe("week");
    expect(timeBucketGranularity({ from: "01.01.2026", to: "15.02.2026" })).toBe("month");
  });

  it("test_aggregateBagsOverTime_weeks_clipped_to_range_split_by_mode", () => {
    const range = { from: "01.09.2026", to: "23.09.2026" };
    const rows = [
      statsRow({
        sheetRow: 2,
        pickupDate: "02.09.2026",
        bagCount: 10,
        mode: "report",
      }),
      statsRow({
        sheetRow: 3,
        pickupDate: "03.09.2026",
        bagCount: 4,
        mode: "schedule",
        address: "B",
      }),
      statsRow({
        sheetRow: 4,
        pickupDate: "22.09.2026",
        bagCount: 7,
        address: "C",
      }),
      statsRow({
        sheetRow: 5,
        pickupDate: "22.09.2026",
        bagCount: 3,
        happened: false,
        address: "D",
      }),
      statsRow({
        sheetRow: 6,
        pickupDate: "31.08.2026",
        bagCount: 99,
        address: "E",
      }),
    ];
    const series = aggregateBagsOverTime(rows, { range });
    expect(series.granularity).toBe("week");
    expect(series.buckets[0]).toMatchObject({
      from: "01.09.2026",
      to: "06.09.2026",
      report: 10,
      schedule: 4,
      total: 14,
      incomplete: false,
    });
    const last = series.buckets[series.buckets.length - 1];
    expect(last).toMatchObject({
      from: "21.09.2026",
      to: "23.09.2026",
      report: 7,
      schedule: 0,
      total: 7,
      incomplete: false,
    });
  });

  it("test_aggregateBagsOverTime_marks_current_week_incomplete_when_asOf", () => {
    const range = { from: "01.09.2026", to: "23.09.2026" };
    const series = aggregateBagsOverTime(
      [statsRow({ sheetRow: 2, pickupDate: "22.09.2026", bagCount: 3 })],
      { range, asOf: { year: 2026, month: 9, day: 23 } },
    );
    expect(series.buckets.every((b, i) => b.incomplete === (i === series.buckets.length - 1))).toBe(
      true,
    );
    expect(series.buckets[series.buckets.length - 1]).toMatchObject({
      from: "21.09.2026",
      to: "23.09.2026",
      incomplete: true,
    });
  });

  it("test_aggregateBagsOverTime_past_month_has_no_incomplete_with_asOf", () => {
    const range = { from: "01.08.2026", to: "31.08.2026" };
    const series = aggregateBagsOverTime(
      [statsRow({ sheetRow: 2, pickupDate: "10.08.2026", bagCount: 1 })],
      { range, asOf: { year: 2026, month: 9, day: 23 } },
    );
    expect(series.buckets.every((b) => b.incomplete === false)).toBe(true);
  });

  it("test_aggregateBagsOverTime_missing_mode_counts_as_report", () => {
    const range = { from: "01.09.2026", to: "07.09.2026" };
    const series = aggregateBagsOverTime(
      [statsRow({ sheetRow: 2, pickupDate: "02.09.2026", bagCount: 5 })],
      { range },
    );
    expect(series.buckets[0].report).toBe(5);
    expect(series.buckets[0].schedule).toBe(0);
  });

  it("test_aggregateCostsOverTime_settled_only_sums_P_by_week", () => {
    const range = { from: "01.09.2026", to: "14.09.2026" };
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        pickupDate: "02.09.2026",
        receptionCost: 3_000,
        costPerBag: 3_000,
        mode: "report",
      }),
      statsRow({
        sheetRow: 3,
        settled: true,
        pickupDate: "03.09.2026",
        receptionCost: 2_000,
        costPerBag: 2_000,
        mode: "schedule",
        address: "B",
      }),
      statsRow({
        sheetRow: 4,
        settled: false,
        pickupDate: "04.09.2026",
        receptionCost: null,
        address: "C",
      }),
      statsRow({
        sheetRow: 5,
        settled: true,
        pickupDate: "10.09.2026",
        receptionCost: 5_000,
        costPerBag: 5_000,
        address: "D",
      }),
    ];
    const series = aggregateCostsOverTime(rows, { range });
    expect(series.granularity).toBe("week");
    expect(series.buckets[0]).toMatchObject({
      report: 3_000,
      schedule: 2_000,
      total: 5_000,
    });
    expect(series.buckets[1]).toMatchObject({
      report: 5_000,
      schedule: 0,
      total: 5_000,
    });
  });

  it("test_aggregateBagsOverTime_quarter_uses_month_buckets", () => {
    const range = previousQuarterPeriod(TODAY);
    const rows = [
      statsRow({
        sheetRow: 2,
        pickupDate: "15.04.2026",
        bagCount: 10,
      }),
      statsRow({
        sheetRow: 3,
        pickupDate: "10.06.2026",
        bagCount: 3,
        address: "B",
        mode: "schedule",
      }),
    ];
    const series = aggregateBagsOverTime(rows, { range });
    expect(series.granularity).toBe("month");
    expect(series.buckets).toHaveLength(3);
    expect(series.buckets.map((b) => b.total)).toEqual([10, 0, 3]);
    expect(series.buckets[2].schedule).toBe(3);
  });
});

describe("aggregateContractorRanks / listZeroBagPickups", () => {
  const range = { from: "01.09.2026", to: "23.09.2026" };

  it("test_aggregateContractorRanks_avg_P_and_Q_top5_excludes_zero_bags", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        settled: true,
        contractor: "eco",
        bagCount: 2,
        receptionCost: 4_000,
        costPerBag: 2_000,
      }),
      statsRow({
        sheetRow: 3,
        settled: true,
        contractor: "eco",
        bagCount: 2,
        receptionCost: 6_000,
        costPerBag: 3_000,
        address: "B",
        pickupDate: "10.09.2026",
      }),
      statsRow({
        sheetRow: 4,
        settled: true,
        contractor: "gpw",
        bagCount: 4,
        receptionCost: 4_000,
        costPerBag: 1_000,
        address: "C",
        pickupDate: "11.09.2026",
      }),
      statsRow({
        sheetRow: 5,
        settled: true,
        contractor: "gpw",
        bagCount: 0,
        receptionCost: 9_999,
        costPerBag: 9_999,
        address: "D",
        pickupDate: "12.09.2026",
      }),
      statsRow({
        sheetRow: 6,
        settled: true,
        contractor: "blue",
        bagCount: 1,
        receptionCost: 500,
        costPerBag: 500,
        address: "E",
        pickupDate: "13.09.2026",
      }),
    ];
    const ranks = aggregateContractorRanks(rows, { range });
    expect(ranks.byShop.expensive[0]).toMatchObject({
      contractor: "eco",
      average: 5_000,
      pickupCount: 2,
    });
    expect(ranks.byShop.cheap[0]).toMatchObject({ contractor: "blue", average: 500 });
    expect(ranks.byBag.expensive[0]).toMatchObject({
      contractor: "eco",
      average: 2_500,
      pickupCount: 2,
    });
    expect(ranks.byBag.cheap[0]).toMatchObject({ contractor: "blue", average: 500 });
    expect(ranks.byBag.cheap[1]).toMatchObject({ contractor: "gpw", average: 1_000 });
  });

  it("test_listZeroBagPickups_happened_bagCount_zero_in_period", () => {
    const rows = [
      statsRow({
        sheetRow: 2,
        bagCount: 0,
        settled: false,
        pickupDate: "10.09.2026",
        address: "Zero A",
      }),
      statsRow({
        sheetRow: 3,
        bagCount: 0,
        settled: true,
        receptionCost: 1_500,
        costPerBag: 1_500,
        pickupDate: "12.09.2026",
        address: "Zero B",
      }),
      statsRow({
        sheetRow: 4,
        bagCount: 1,
        pickupDate: "10.09.2026",
        address: "With bags",
      }),
      statsRow({
        sheetRow: 5,
        bagCount: null,
        pickupDate: "10.09.2026",
        address: "Null bags",
      }),
      statsRow({
        sheetRow: 6,
        bagCount: 0,
        happened: false,
        pickupDate: "10.09.2026",
        address: "Not happened",
      }),
      statsRow({
        sheetRow: 7,
        bagCount: 0,
        pickupDate: "31.08.2026",
        address: "Out of range",
      }),
    ];
    const list = listZeroBagPickups(rows, { range });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      address: "Zero A",
      settled: false,
      receptionCost: null,
      pickupDate: "10.09.2026",
    });
    expect(list[1]).toMatchObject({
      address: "Zero B",
      settled: true,
      receptionCost: 1_500,
    });
  });
});

describe("labels", () => {
  it("test_monthOptionLabel_and_statsPeriodKindLabel", () => {
    expect(monthOptionLabel("2026-09")).toBe("wrzesień 2026");
    expect(monthOptionLabel("bad")).toBe("bad");
    expect(quarterOptionLabel("2026-Q3")).toBe("III kwartał 2026");
    expect(statsPeriodKindLabel("current")).toBe("bieżący miesiąc");
    expect(statsPeriodKindLabel("quarter")).toBe("bieżący kwartał");
    expect(statsPeriodKindLabel("prevQuarter", "", "2026-Q2")).toBe("II kwartał 2026");
    expect(statsPeriodKindLabel("prev", "2026-08")).toBe("sierpień 2026");
    expect(statsPeriodKindLabel("exact")).toBe("dokładny zakres");
  });

  it("test_rateGapLabel_kinds", () => {
    expect(rateGapLabel("emptyPickup")).toBe("Brak stawki za dojazd");
    expect(rateGapLabel("emptyBag")).toBe("Brak stawki za worek");
    expect(rateGapLabel("tie")).toBe("Konflikt: kilka stawek w bazie");
  });
});
