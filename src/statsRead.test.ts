import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SettlementStatsResult } from "./search.js";
import { aggregateBacklog, aggregateSettled, type StatsRow } from "./stats.js";

const gsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../arkusz-mapa/google-apps-script/transport-log.gs",
);

const gs = readFileSync(gsPath, "utf8");

const WRITE_CALL = /setValue|setValues|appendRow|insertSheet|deleteRow|deleteRows|getOrCreate|setFormula/;

function pureBlock(): string {
  const start = gs.indexOf("/* settlement-read-pure:start */");
  const end = gs.indexOf("/* settlement-read-pure:end */");
  if (start < 0 || end < start) {
    throw new Error("brak bloku settlement-read-pure");
  }
  return gs.slice(start, end);
}

function functionSource(name: string): string {
  const marker = `function ${name}(`;
  const start = gs.indexOf(marker);
  if (start < 0) {
    throw new Error(`brak funkcji ${name}`);
  }
  const brace = gs.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < gs.length; i++) {
    const ch = gs[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return gs.slice(start, i + 1);
      }
    }
  }
  throw new Error(`niezamknięta funkcja ${name}`);
}

function loadStats(): (
  query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
  register: { sheetRow: number; cells: unknown[] }[],
  rates: { sheetRow: number; cells: unknown[] }[],
  odebrane?: { headers: string[]; rows: unknown[][] },
) => SettlementStatsResult {
  const block = pureBlock();
  expect(block).not.toMatch(/SpreadsheetApp|LockService/);
  expect(block).not.toMatch(WRITE_CALL);
  const load = new Function(`${block}\nreturn buildSettlementStats_;`) as () => (
    query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
    register: { sheetRow: number; cells: unknown[] }[],
    rates: { sheetRow: number; cells: unknown[] }[],
    odebrane?: { headers: string[]; rows: unknown[][] },
  ) => SettlementStatsResult;
  return load();
}

const stats = loadStats();

function cells(over: Partial<Record<number, unknown>> = {}): unknown[] {
  const row = Array.from({ length: 18 }, () => "" as unknown);
  row[0] = "15";
  row[1] = "Sklepowa 1";
  row[3] = "Sklep";
  row[4] = "18.09.2026";
  row[5] = "gpw";
  row[8] = 2;
  for (const [key, value] of Object.entries(over)) {
    row[Number(key)] = value;
  }
  return row;
}

function entry(sheetRow: number, over: Partial<Record<number, unknown>> = {}) {
  return { sheetRow, cells: cells(over) };
}

const period = { dataOd: "01.09.2026", dataDo: "30.09.2026" };
const gpw = { ...period, podwykonawca: "gpw" };

function toStatsRows(result: SettlementStatsResult): StatsRow[] {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return [];
  }
  return result.rows;
}

describe("buildSettlementStats_", () => {
  it("test_buildSettlementStats_includes_settled_in_range_with_P_Q", () => {
    const result = stats(
      gpw,
      [
        entry(2, { 13: "tak", 15: 30, 16: 15 }),
        entry(3, { 4: "01.08.2026", 13: "tak", 15: 99, 16: 99 }),
      ],
      [],
    );
    const rows = toStatsRows(result);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sheetRow: 2,
      settled: true,
      happened: true,
      receptionCost: 3_000,
      costPerBag: 1_500,
      bagCount: 2,
    });
  });

  it("test_buildSettlementStats_unsettled_outside_range_stays_for_backlog", () => {
    const result = stats(
      gpw,
      [entry(2, { 4: "01.01.2020" }), entry(3, { 4: "15.09.2026", 13: "tak", 15: 10, 16: 5 })],
      [],
    );
    expect(toStatsRows(result).map((row) => row.sheetRow)).toEqual([2, 3]);
  });

  it("test_buildSettlementStats_transport_nie_excluded", () => {
    const result = stats(
      gpw,
      [entry(2, { 17: "nie" }), entry(3, { 17: "tak" }), entry(4)],
      [],
    );
    expect(toStatsRows(result).map((row) => row.sheetRow)).toEqual([3, 4]);
  });

  it("test_buildSettlementStats_empty_contractor_returns_all", () => {
    const result = stats(
      period,
      [entry(2, { 5: "gpw" }), entry(3, { 5: "inna", 0: "16" })],
      [
        { sheetRow: 2, cells: ["Sklepowa 1", "gpw", 20, 10, ""] },
        { sheetRow: 3, cells: ["Inna 2", "inna", 5, 5, ""] },
      ],
    );
    const rows = toStatsRows(result);
    expect(rows.map((row) => row.contractor).sort()).toEqual(["gpw", "inna"]);
    expect(result.ok && result.rates.map((rate) => rate.contractor).sort()).toEqual(["gpw", "inna"]);
  });

  it("test_buildSettlementStats_filters_contractor", () => {
    const result = stats(
      gpw,
      [entry(2, { 5: "gpw" }), entry(3, { 5: "inna" })],
      [
        { sheetRow: 2, cells: ["Sklepowa 1", "gpw", 20, 10, ""] },
        { sheetRow: 3, cells: ["Inna 2", "inna", 5, 5, ""] },
      ],
    );
    expect(toStatsRows(result).map((row) => row.sheetRow)).toEqual([2]);
    expect(result.ok && result.rates.map((rate) => rate.sheetRow)).toEqual([2]);
  });

  it("test_buildSettlementStats_requires_both_dates", () => {
    expect(stats({ podwykonawca: "gpw", dataDo: "30.09.2026" }, [entry(2)], [])).toEqual({
      ok: false,
      error: "dataOd required",
    });
    expect(stats({ podwykonawca: "gpw", dataOd: "01.09.2026" }, [entry(2)], [])).toEqual({
      ok: false,
      error: "dataDo required",
    });
  });

  it("test_buildSettlementStats_data_od_after_data_do_error", () => {
    expect(
      stats({ dataOd: "09.10.2026", dataDo: "10.09.2026" }, [entry(2)], []),
    ).toEqual({ ok: false, error: "dataOd after dataDo" });
  });

  it("test_buildSettlementStats_rows_feed_aggregations", () => {
    const result = stats(
      gpw,
      [
        entry(2, { 13: "tak", 15: 40, 16: 20 }),
        entry(3, { 4: "01.01.2020", 11: 20, 12: 10, 8: 1 }),
        entry(4, { 17: "nie", 13: "tak", 15: 99 }),
      ],
      [],
    );
    const rows = toStatsRows(result);
    expect(aggregateSettled(rows, { range: { from: "01.09.2026", to: "30.09.2026" } })).toEqual({
      count: 1,
      receptionSum: 4_000,
    });
    expect(aggregateBacklog(rows).count).toBe(1);
  });

  it("test_buildSettlementStats_odebrane_groups_bags_as_schedule", () => {
    const headers = [
      "NIP",
      "Podmiot",
      "Sklep",
      "Wg",
      "Dni",
      "Firma transportowa",
      "Kod pocztowy",
      "Miasto",
      "Ulica",
      "Numer budynku",
      "Gmina",
      "Woj",
      "Plomba",
      "Stan",
      "TMS",
      "Data zamknięcia worka",
    ];
    const bag = (over: Record<string, unknown> = {}) => {
      const row = Array.from({ length: 16 }, () => "" as unknown);
      row[2] = "Gama";
      row[5] = "gpw";
      row[6] = "22-300";
      row[7] = "Krasnystaw";
      row[8] = "Królowej";
      row[9] = "1";
      row[15] = "18.09.2026";
      for (const [k, v] of Object.entries(over)) {
        row[Number(k)] = v;
      }
      return row;
    };
    const result = stats(
      gpw,
      [entry(2, { 13: "tak", 15: 10, 16: 5 })],
      [],
      {
        headers,
        rows: [bag(), bag({ 12: "p2" }), bag({ 5: "inna", 12: "p3" }), bag({ 15: "01.08.2026", 12: "p4" })],
      },
    );
    const rows = toStatsRows(result);
    const schedule = rows.filter((row) => row.mode === "schedule");
    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({
      mode: "schedule",
      bagCount: 2,
      contractor: "gpw",
      shopName: "Gama",
      pickupDate: "18.09.2026",
      settled: false,
      happened: true,
    });
    expect(rows.find((row) => row.mode === "report" || row.mode === undefined)).toMatchObject({
      sheetRow: 2,
      mode: "report",
    });
  });
});

describe("akcja settlementStats w transport-log.gs", () => {
  it("test_settlementStats_reads_without_write_and_only_on_get", () => {
    const body = functionSource("settlementStats_");
    expect(body).toContain("buildSettlementStats_");
    expect(body).toContain("getSheetByName(RATE_SHEET_NAME)");
    expect(body).toContain("ODEBRANE_Z_HARMONOGRAMU_SHEET_NAME");
    expect(body).toContain("readOdebraneSheetRows_");
    expect(body).not.toMatch(WRITE_CALL);
    expect(gs).toContain("action === 'settlementStats'");
    const getFn = functionSource("doGet");
    expect(getFn).toContain("settlementStats");
    const postFn = functionSource("doPost");
    expect(postFn).not.toContain("settlementStats");
    expect(postFn.indexOf("settlementSearch")).toBeLessThan(postFn.indexOf("waitLock"));
  });

  it("test_settlementSearch_still_excludes_settled", () => {
    const block = pureBlock();
    type SearchResult = { ok: boolean; rows: { sheetRow: number }[] };
    const load = new Function(`${block}\nreturn buildSettlementRead_;`) as () => (
      query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
      register: { sheetRow: number; cells: unknown[] }[],
      rates: { sheetRow: number; cells: unknown[] }[],
    ) => SearchResult;
    const read = load();
    const result = read(gpw, [entry(2, { 13: "tak" }), entry(3, { 0: "16" })], []);
    expect(result.ok).toBe(true);
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });
});
