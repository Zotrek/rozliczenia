import { describe, expect, it } from "vitest";
import {
  buildStatsReport,
  chartShouldStack,
  pageSlice,
  previousMonthOptions,
  resolveStatsPeriod,
  STATS_PAGE_SIZE,
  STATS_STACK_MIN_BUCKETS,
  type StatsRow,
} from "./stats.js";
import {
  defaultStatsView,
  loadTablesCollapsed,
  renderStatsScreen,
  STATS_FOLD_LS_PREFIX,
} from "./statsView.js";
import { readSettlementStats } from "./statement.js";
import { statsParams } from "./range.js";

function row(over: Partial<StatsRow> & Pick<StatsRow, "sheetRow">): StatsRow {
  return {
    sheetRow: over.sheetRow,
    transportNumber: over.transportNumber ?? String(over.sheetRow),
    address: over.address ?? "Sklepowa 1",
    shopName: over.shopName ?? "Sklep",
    pickupDate: over.pickupDate ?? "10.09.2026",
    contractor: over.contractor ?? "gpw",
    bagCount: over.bagCount ?? 2,
    routeName: over.routeName ?? "",
    routeRate: over.routeRate ?? null,
    pickupRate: over.pickupRate ?? 2_000,
    bagRate: over.bagRate ?? 1_000,
    settled: over.settled ?? true,
    happened: over.happened ?? true,
    receptionCost: over.receptionCost ?? 4_000,
    costPerBag: over.costPerBag ?? 2_000,
    mode: over.mode,
  };
}

const TODAY = { year: 2026, month: 9, day: 23 };

describe("resolveStatsPeriod", () => {
  it("test_resolveStatsPeriod_current_and_quarter", () => {
    expect(resolveStatsPeriod("current", TODAY, { month: "", from: "", to: "" })).toEqual({
      from: "01.09.2026",
      to: "23.09.2026",
    });
    expect(resolveStatsPeriod("quarter", TODAY, { month: "", from: "", to: "" })).toEqual({
      from: "01.04.2026",
      to: "30.06.2026",
    });
  });

  it("test_resolveStatsPeriod_prev_month_and_exact", () => {
    expect(
      resolveStatsPeriod("prev", TODAY, { month: "2026-08", from: "", to: "" }),
    ).toEqual({ from: "01.08.2026", to: "31.08.2026" });
    expect(
      resolveStatsPeriod("exact", TODAY, { month: "", from: "2026-09-01", to: "2026-09-10" }),
    ).toEqual({ from: "01.09.2026", to: "10.09.2026" });
    expect(
      resolveStatsPeriod("exact", TODAY, { month: "", from: "2026-09-10", to: "2026-09-01" }),
    ).toBeNull();
  });
});

describe("previousMonthOptions", () => {
  it("test_previousMonthOptions_starts_from_previous_month", () => {
    const months = previousMonthOptions(TODAY, 3);
    expect(months).toEqual([
      { year: 2026, month: 8, value: "2026-08", label: "sierpień 2026" },
      { year: 2026, month: 7, value: "2026-07", label: "lipiec 2026" },
      { year: 2026, month: 6, value: "2026-06", label: "czerwiec 2026" },
    ]);
  });
});

describe("pageSlice", () => {
  it("test_pageSlice_five_per_page", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(STATS_PAGE_SIZE).toBe(5);
    expect(pageSlice(items, 1)).toEqual({ page: 1, pages: 2, slice: [1, 2, 3, 4, 5], total: 7 });
    expect(pageSlice(items, 2)).toEqual({ page: 2, pages: 2, slice: [6, 7], total: 7 });
    expect(pageSlice(items, 9).page).toBe(2);
  });
});

describe("buildStatsReport", () => {
  it("test_buildStatsReport_wires_aggregations", () => {
    const report = buildStatsReport(
      [
        row({ sheetRow: 2, settled: true, receptionCost: 5_000, costPerBag: 2_500, bagCount: 2 }),
        row({
          sheetRow: 3,
          settled: false,
          bagCount: 0,
          receptionCost: null,
          costPerBag: null,
          pickupDate: "12.09.2026",
        }),
      ],
      [],
      { range: { from: "01.09.2026", to: "30.09.2026" } },
    );
    expect(report.activity.pickupCount).toBe(2);
    expect(report.settled.count).toBe(1);
    expect(report.zeroBags).toHaveLength(1);
    expect(report.bagsOverTime.buckets.length).toBeGreaterThan(0);
  });
});

describe("statsParams", () => {
  it("test_statsParams_omits_empty_contractor", () => {
    expect(statsParams({ dataOd: "01.09.2026", dataDo: "23.09.2026" })).toEqual({
      action: "settlementStats",
      dataOd: "01.09.2026",
      dataDo: "23.09.2026",
    });
    expect(
      statsParams({ dataOd: "01.09.2026", dataDo: "23.09.2026", podwykonawca: "gpw" }),
    ).toEqual({
      action: "settlementStats",
      dataOd: "01.09.2026",
      dataDo: "23.09.2026",
      podwykonawca: "gpw",
    });
  });
});

describe("readSettlementStats", () => {
  it("test_readSettlementStats_keeps_settled_and_costs", () => {
    const result = readSettlementStats({
      ok: true,
      rows: [
        {
          sheetRow: 2,
          transportNumber: "2",
          address: "A",
          shopName: "S",
          pickupDate: "10.09.2026",
          contractor: "gpw",
          bagCount: 1,
          routeName: "",
          routeRate: null,
          pickupRate: 1000,
          bagRate: 500,
          settled: true,
          happened: true,
          receptionCost: 1500,
          costPerBag: 1500,
        },
      ],
      rates: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0].settled).toBe(true);
    expect(result.rows[0].receptionCost).toBe(1500);
  });
});

describe("renderStatsScreen", () => {
  it("test_renderStatsScreen_empty_prompts_show", () => {
    const html = renderStatsScreen(defaultStatsView(TODAY));
    expect(html).toContain('data-screen="stats"');
    expect(html).toContain("Pokaż raport");
    expect(html).toContain("Bieżący miesiąc");
    expect(html).toContain("Wybierz okres");
  });

  it("test_renderStatsScreen_report_shows_kpi_and_sections", () => {
    const report = buildStatsReport(
      [row({ sheetRow: 2 })],
      [],
      { range: { from: "01.09.2026", to: "23.09.2026" } },
    );
    const html = renderStatsScreen(
      defaultStatsView(TODAY, {
        report,
        appliedFrom: "01.09.2026",
        appliedTo: "23.09.2026",
        appliedKind: "current",
        contractors: [{ nazwa: "gpw", dane: "x" }],
      }),
    );
    expect(html).toContain("Liczba odbiorów");
    expect(html).toContain("Ile worków zabrano w czasie");
    expect(html).toContain("Problemy ze stawkami");
    expect(html).toContain("Odbiory bez worków");
    expect(html).toContain('data-fold="bags"');
    expect(html).toContain("Podwykonawcy");
  });
});

describe("chartShouldStack", () => {
  it("test_chartShouldStack_uses_bucket_threshold", () => {
    expect(STATS_STACK_MIN_BUCKETS).toBe(7);
    expect(
      chartShouldStack({
        granularity: "week",
        buckets: Array.from({ length: 6 }, (_, i) => ({
          label: String(i),
          from: "01.09.2026",
          to: "01.09.2026",
          report: 1,
          schedule: 0,
          total: 1,
        })),
      }),
    ).toBe(false);
    expect(
      chartShouldStack({
        granularity: "week",
        buckets: Array.from({ length: 7 }, (_, i) => ({
          label: String(i),
          from: "01.09.2026",
          to: "01.09.2026",
          report: 1,
          schedule: 0,
          total: 1,
        })),
      }),
    ).toBe(true);
  });
});

describe("loadTablesCollapsed", () => {
  it("test_loadTablesCollapsed_defaults_closed_when_stacked", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
      removeItem: (k: string) => {
        memory.delete(k);
      },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    expect(loadTablesCollapsed(storage, ["bags"], { bags: true }).bags).toBe(true);
    expect(loadTablesCollapsed(storage, ["bags"], { bags: false }).bags).toBe(false);
    storage.setItem(STATS_FOLD_LS_PREFIX + "table.bags", "open");
    expect(loadTablesCollapsed(storage, ["bags"], { bags: true }).bags).toBe(false);
  });
});
