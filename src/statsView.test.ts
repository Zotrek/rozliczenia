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
  emptyPickupTable,
  filterPeriodPickups,
  loadSectionsCollapsed,
  loadTablesCollapsed,
  pickupCellText,
  pickupColumnChoices,
  readStatsFold,
  renderStatsScreen,
  sortPeriodPickups,
  STATS_FOLD_LS_PREFIX,
  visiblePeriodPickups,
  writeStatsFold,
  type PickupTableState,
} from "./statsView.js";
import type { PeriodPickup } from "./stats.js";
import { readSettlementStats } from "./statement.js";
import { statsParams } from "./range.js";

function row(over: Partial<StatsRow> & Pick<StatsRow, "sheetRow">): StatsRow {
  return {
    sheetName: over.sheetName ?? "",
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
    invoice: over.invoice,
    mode: over.mode,
  };
}

const TODAY = { year: 2026, month: 9, day: 23 };

describe("resolveStatsPeriod", () => {
  const emptyDraft = { month: "", quarter: "", from: "", to: "" };

  it("test_resolveStatsPeriod_current_and_quarter", () => {
    expect(resolveStatsPeriod("current", TODAY, emptyDraft)).toEqual({
      from: "01.09.2026",
      to: "23.09.2026",
    });
    expect(resolveStatsPeriod("quarter", TODAY, emptyDraft)).toEqual({
      from: "01.07.2026",
      to: "23.09.2026",
    });
  });

  it("test_resolveStatsPeriod_prev_month_prev_quarter_and_exact", () => {
    expect(
      resolveStatsPeriod("prev", TODAY, { ...emptyDraft, month: "2026-08" }),
    ).toEqual({ from: "01.08.2026", to: "31.08.2026" });
    expect(
      resolveStatsPeriod("prevQuarter", TODAY, { ...emptyDraft, quarter: "2026-Q2" }),
    ).toEqual({ from: "01.04.2026", to: "30.06.2026" });
    expect(
      resolveStatsPeriod("exact", TODAY, {
        ...emptyDraft,
        from: "2026-09-01",
        to: "2026-09-10",
      }),
    ).toEqual({ from: "01.09.2026", to: "10.09.2026" });
    expect(
      resolveStatsPeriod("exact", TODAY, {
        ...emptyDraft,
        from: "2026-09-10",
        to: "2026-09-01",
      }),
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
    expect(report.periodPickups).toHaveLength(2);
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
          invoice: " FV/2 ",
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
    expect(result.rows[0].invoice).toBe("FV/2");
  });
});

describe("renderStatsScreen", () => {
  it("test_renderStatsScreen_empty_prompts_show", () => {
    const html = renderStatsScreen(defaultStatsView(TODAY));
    expect(html).toContain('data-screen="stats"');
    expect(html).toContain("Pokaż raport");
    expect(html).toContain("Bieżący miesiąc");
    expect(html).toContain("Bieżący kwartał");
    expect(html).toContain("Poprzednie kwartały");
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
    expect(html).toContain("Odbiory w okresie");
    expect(html).toContain("Ile worków zabrano w czasie");
    expect(html).toContain("Problemy ze stawkami");
    expect(html).toContain("Odbiory bez worków");
    expect(html).toContain('data-fold="bags"');
    expect(html).toContain('data-fold="pickups"');
    expect(html).toContain("Podwykonawcy");
    expect(html).toContain("Najdroższe sklepy");
    expect(html).toContain(">Worki</th>");
    expect(html).toContain("Najdrożsi");
  });

  it("test_renderStats_q_ranks_show_bag_count", () => {
    const report = buildStatsReport(
      [
        row({
          sheetRow: 2,
          settled: true,
          receptionCost: 5_000,
          costPerBag: 2_500,
          bagCount: 7,
          address: "Drogi 1",
        }),
      ],
      [],
      { range: { from: "01.09.2026", to: "23.09.2026" } },
    );
    const html = renderStatsScreen(
      defaultStatsView(TODAY, {
        report,
        appliedFrom: "01.09.2026",
        appliedTo: "23.09.2026",
      }),
    );
    expect(html).toContain("Drogi 1");
    expect(html).toMatch(/<td class="num">7<\/td>/);
  });

  it("test_renderStats_pickup_links_preview_and_edit_and_shows_invoice_value", () => {
    const report = buildStatsReport(
      [
        row({
          sheetRow: 2,
          settled: true,
          invoice: "FV/9",
          receptionCost: 5_000,
          address: "Drogi 1",
          contractor: "gpw",
        }),
        row({
          sheetRow: 3,
          settled: true,
          invoice: "FV/9",
          receptionCost: 2_500,
          address: "Drogi 2",
          contractor: "gpw",
          pickupDate: "11.09.2026",
        }),
        row({
          sheetRow: 4,
          settled: false,
          address: "Otwarte 3",
          pickupDate: "12.09.2026",
        }),
        row({
          sheetRow: 5,
          settled: false,
          mode: "schedule",
          address: "Harm 4",
          pickupDate: "13.09.2026",
          invoice: "",
        }),
      ],
      [],
      { range: { from: "01.09.2026", to: "23.09.2026" } },
    );
    const html = renderStatsScreen(
      defaultStatsView(TODAY, {
        report,
        appliedFrom: "01.09.2026",
        appliedTo: "23.09.2026",
      }),
    );
    expect(html).toContain("Wartość faktury");
    expect(html).toContain("Numer faktury");
    expect(html).toContain("75,00");
    expect(html).toContain('>Tak</td><td><span class="invoice-no">FV/9</span><div class="row-links">');
    expect(html.match(/data-action="invoice-preview"/g)).toHaveLength(3);
    expect(html.match(/data-action="invoice-edit"/g)).toHaveLength(3);
    expect(html).toContain('data-mode="schedule"');
    expect(html).toContain('data-invoice="FV/9"');
    expect(html).toContain('data-invoice-known="1"');
    expect(html).toContain('data-contractor="gpw"');
    expect(html).toContain('data-mode="report"');
    const open = html.slice(html.indexOf("Otwarte 3"), html.indexOf("Harm 4"));
    expect(open).toContain(">Nie</td><td>—</td>");
    expect(open).not.toContain("invoice-preview");
  });

  it("test_renderStats_marks_incomplete_week_column", () => {
    const report = buildStatsReport(
      [row({ sheetRow: 2, settled: true, receptionCost: 5_000, costPerBag: 2_500, bagCount: 2 })],
      [],
      {
        range: { from: "01.09.2026", to: "23.09.2026" },
        asOf: TODAY,
      },
    );
    const html = renderStatsScreen(
      defaultStatsView(TODAY, {
        report,
        appliedFrom: "01.09.2026",
        appliedTo: "23.09.2026",
        appliedKind: "current",
      }),
    );
    expect(html).toContain("bags-time-col is-incomplete");
    expect(html).toContain("· trwa");
    expect(html).toContain("Okres trwa — liczby mogą wzrosnąć");
    expect(html).toContain("(trwa)");
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
          incomplete: false,
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
          incomplete: false,
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

describe("stats fold storage", () => {
  it("test_readWriteStatsFold_and_loadSectionsCollapsed", () => {
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
    expect(readStatsFold(null, "section.bags")).toBeNull();
    writeStatsFold(null, "section.bags", "closed");
    writeStatsFold(storage, "section.bags", "closed");
    expect(readStatsFold(storage, "section.bags")).toBe("closed");
    expect(loadSectionsCollapsed(storage, ["bags", "costs"])).toEqual({
      bags: true,
      costs: false,
    });
  });
});

function pickup(over: Partial<PeriodPickup> = {}): PeriodPickup {
  return {
    address: over.address ?? "A 1",
    shopName: over.shopName ?? "Sklep",
    contractor: over.contractor ?? "gpw",
    pickupDate: over.pickupDate ?? "10.09.2026",
    bagCount: over.bagCount === undefined ? 2 : over.bagCount,
    mode: over.mode ?? "report",
    settled: over.settled ?? true,
    invoice: over.invoice ?? "FV/1",
    invoiceKnown: over.invoiceKnown ?? true,
    invoiceValue: over.invoiceValue === undefined ? 4_000 : over.invoiceValue,
  };
}

describe("period pickup filter and sort", () => {
  const rows = [
    pickup({ address: "B 2", shopName: "Beta", contractor: "blue", pickupDate: "12.09.2026", bagCount: 10, settled: false, invoiceValue: null }),
    pickup({ address: "A 10", shopName: "Alfa", contractor: "gpw", pickupDate: "02.09.2026", bagCount: 2, mode: "schedule" }),
    pickup({ address: "A 2", shopName: "Alfa", contractor: "gpw", pickupDate: "11.09.2026", bagCount: null, invoiceValue: 1_500 }),
  ];

  it("test_filterPeriodPickups_keeps_rows_matching_every_column", () => {
    const filtered = filterPeriodPickups(rows, {
      contractor: ["gpw"],
      mode: ["Na zgłoszenie"],
    });
    expect(filtered.map((row) => row.address)).toEqual(["A 2"]);
  });

  it("test_filterPeriodPickups_empty_selection_shows_nothing", () => {
    expect(filterPeriodPickups(rows, { contractor: [] })).toEqual([]);
  });

  it("test_sortPeriodPickups_orders_dates_and_keeps_blank_bags_last", () => {
    expect(sortPeriodPickups(rows, "date", "desc").map((row) => row.pickupDate)).toEqual([
      "12.09.2026",
      "11.09.2026",
      "02.09.2026",
    ]);
    expect(sortPeriodPickups(rows, "bags", "asc").map((row) => row.bagCount)).toEqual([2, 10, null]);
    expect(sortPeriodPickups(rows, "bags", "desc").map((row) => row.bagCount)).toEqual([10, 2, null]);
    expect(sortPeriodPickups(rows, "shop", "asc").map((row) => row.address)).toEqual(["A 2", "A 10", "B 2"]);
  });

  it("test_pickupColumnChoices_ignores_the_open_column_and_uses_other_filters", () => {
    expect(pickupColumnChoices(rows, { contractor: ["gpw"] }, "shop")).toEqual([
      "A 2 · Alfa",
      "A 10 · Alfa",
    ]);
    expect(pickupCellText(rows[0], "settled")).toBe("Nie");
    expect(pickupCellText(rows[0], "invoiceNumber")).toBe("FV/1");
    expect(pickupCellText(pickup({ invoice: "" }), "invoiceNumber")).toBe("—");
  });

  it("test_visiblePeriodPickups_filters_before_sort", () => {
    const state: PickupTableState = {
      ...emptyPickupTable(),
      sortKey: "date",
      sortDir: "asc",
      filters: { contractor: ["gpw"] },
    };
    expect(visiblePeriodPickups(rows, state).map((row) => row.pickupDate)).toEqual([
      "02.09.2026",
      "11.09.2026",
    ]);
  });

  it("test_renderStats_pickup_menu_lists_values_and_marks_active_filter", () => {
    const report = buildStatsReport(
      [
        row({ sheetRow: 2, contractor: "gpw", address: "A 2", shopName: "Alfa", pickupDate: "02.09.2026" }),
        row({ sheetRow: 3, contractor: "blue", address: "B 2", shopName: "Beta", pickupDate: "12.09.2026" }),
      ],
      [],
      { range: { from: "01.09.2026", to: "23.09.2026" } },
    );
    const html = renderStatsScreen(
      defaultStatsView(TODAY, {
        report,
        appliedFrom: "01.09.2026",
        appliedTo: "23.09.2026",
        pickups: {
          ...emptyPickupTable(),
          sortKey: "date",
          sortDir: "desc",
          filters: { contractor: ["gpw"] },
          menu: { column: "contractor", draft: ["gpw"], query: "" },
        },
      }),
    );
    const pickups = html.slice(html.indexOf("Odbiory w okresie"), html.indexOf("Ile worków zabrano"));
    expect(pickups).toContain('data-action="pickup-menu"');
    expect(pickups).toContain("Sortuj od A do Z");
    expect(pickups).toContain("Sortuj od Z do A");
    expect(pickups).toContain('aria-label="Sortuj i filtruj kolumnę Data, sortowanie malejąco">▼');
    expect(pickups).toContain("(Zaznacz wszystko)");
    expect(pickups).toContain('data-pickup-value="gpw"');
    expect(pickups).toContain('data-pickup-value="blue"');
    expect(pickups).toContain("Filtr: Podwykonawca");
    expect(pickups).toContain("Sortowanie: Data, od najnowszych");
    expect(pickups).toContain('class="xl-btn is-on"');
    expect(pickups).toContain("A 2");
    expect(pickups).not.toContain("B 2");
  });
});
