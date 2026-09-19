import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { settle } from "./engine.js";
import type { SettlementSearchResult } from "./search.js";

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

function loadRead(): (
  query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
  register: { sheetRow: number; cells: unknown[] }[],
  rates: { sheetRow: number; cells: unknown[] }[],
) => SettlementSearchResult {
  const block = pureBlock();
  expect(block).not.toMatch(/SpreadsheetApp|LockService/);
  expect(block).not.toMatch(WRITE_CALL);
  const load = new Function(`${block}\nreturn buildSettlementRead_;`) as () => (
    query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
    register: { sheetRow: number; cells: unknown[] }[],
    rates: { sheetRow: number; cells: unknown[] }[],
  ) => SettlementSearchResult;
  return load();
}

const read = loadRead();

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

const open = { podwykonawca: "gpw", dataOd: "01.09.2026", dataDo: "30.09.2026" };

describe("buildSettlementRead_", () => {
  it("test_buildSettlementRead_settled_tak_excluded", () => {
    const result = read(open, [entry(4, { 13: "tak" }), entry(5, { 0: "16" })], []);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([5]);
  });

  it("test_buildSettlementRead_transport_nie_excluded", () => {
    const result = read(
      open,
      [entry(4, { 17: "nie" }), entry(6, { 17: "NIE" }), entry(7, { 17: "tak" })],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([7]);
  });

  it("test_buildSettlementRead_other_than_tak_stays", () => {
    const result = read(open, [entry(3, { 13: "nie" }), entry(4, { 13: " TAK " })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_missing_column_18_means_happened", () => {
    const short = cells().slice(0, 11);
    const result = read(open, [{ sheetRow: 8, cells: short }], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.sheetRow).toBe(8);
  });

  it("test_buildSettlementRead_row_keeps_sheet_row_and_column_1", () => {
    const result = read(open, [entry(12, { 0: "A-7" })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0]).toMatchObject({ sheetRow: 12, transportNumber: "A-7" });
  });

  it("test_buildSettlementRead_numeric_column_1_stays_text", () => {
    const result = read(open, [entry(2, { 0: 42 })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0]?.transportNumber).toBe("42");
  });

  it("test_buildSettlementRead_same_day_inclusive", () => {
    const query = { podwykonawca: "gpw", dataOd: "18.09.2026", dataDo: "18.09.2026" };
    const result = read(
      query,
      [entry(2, { 4: "17.09.2026" }), entry(3), entry(4, { 4: "19.09.2026" })],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_no_data_od_includes_earlier", () => {
    const result = read(
      { podwykonawca: "gpw", dataDo: "18.09.2026" },
      [entry(2, { 4: "01.01.2020" }), entry(3, { 4: "19.09.2026" })],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.pickupDate)).toEqual(["01.01.2020"]);
  });

  it("test_buildSettlementRead_calendar_not_text_order", () => {
    const result = read(
      { podwykonawca: "gpw", dataOd: "01.09.2026", dataDo: "30.09.2026" },
      [entry(2, { 4: "10.09.2026" }), entry(3, { 4: "09.10.2026" })],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.pickupDate)).toEqual(["10.09.2026"]);
  });

  it("test_buildSettlementRead_october_2025_outside_february_2026", () => {
    const result = read(
      { podwykonawca: "gpw", dataOd: "01.01.2026", dataDo: "28.02.2026" },
      [entry(2, { 4: "01.10.2025" }), entry(3, { 4: "01.02.2026" })],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_other_contractor_excluded", () => {
    const result = read(open, [entry(2, { 5: "inna" }), entry(3, { 5: " gpw " })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_iso_date_skipped_not_failed", () => {
    const result = read(open, [entry(2, { 4: "2026-09-18" }), entry(3)], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_date_object_becomes_dd_mm_yyyy", () => {
    const result = read(open, [entry(2, { 4: new Date(2026, 8, 18) })], []);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0]?.pickupDate).toBe("18.09.2026");
  });

  it("test_buildSettlementRead_amounts_grosze_zero_and_empty", () => {
    const result = read(
      open,
      [entry(2, { 8: 0, 11: "trasa-1", 12: 0 }), entry(3, { 8: "", 12: "" })],
      [
        { sheetRow: 2, cells: ["Sklepowa 1", "gpw", 20, "10,5", ""] },
        { sheetRow: 4, cells: ["Inna 2", "gpw", 0, "", "10.09.2026"] },
        { sheetRow: 5, cells: ["Obca", "inna", 99, 99, ""] },
      ],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows[0]).toMatchObject({ bagCount: 0, routeName: "trasa-1", routeRate: 0 });
    expect(result.rows[1]).toMatchObject({ bagCount: null, routeRate: null, routeName: "" });
    expect(result.rates).toEqual([
      {
        sheetRow: 2,
        shop: "Sklepowa 1",
        contractor: "gpw",
        pickupAmount: 2_000,
        bagAmount: 1_050,
        validFrom: "",
      },
      {
        sheetRow: 4,
        shop: "Inna 2",
        contractor: "gpw",
        pickupAmount: 0,
        bagAmount: null,
        validFrom: "10.09.2026",
      },
    ]);
  });

  it("test_buildSettlementRead_bad_rate_date_skipped", () => {
    const result = read(open, [entry(2)], [
      { sheetRow: 2, cells: ["Sklepowa 1", "gpw", 20, 10, "2026-09-01"] },
      { sheetRow: 3, cells: ["Sklepowa 1", "gpw", 20, 10, ""] },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rates.map((rate) => rate.sheetRow)).toEqual([3]);
  });

  it("test_buildSettlementRead_data_od_after_data_do_error", () => {
    expect(
      read({ podwykonawca: "gpw", dataOd: "09.10.2026", dataDo: "10.09.2026" }, [entry(2)], []),
    ).toEqual({ ok: false, error: "dataOd after dataDo" });
  });

  it("test_buildSettlementRead_missing_contractor_error", () => {
    expect(read({ dataDo: "18.09.2026" }, [entry(2)], [])).toEqual({
      ok: false,
      error: "podwykonawca required",
    });
  });

  it("test_buildSettlementRead_missing_data_do_error", () => {
    expect(read({ podwykonawca: "gpw" }, [entry(2)], [])).toEqual({
      ok: false,
      error: "dataDo required",
    });
  });

  it("test_buildSettlementRead_bad_data_do_error", () => {
    expect(read({ podwykonawca: "gpw", dataDo: "31.02.2026" }, [entry(2)], [])).toEqual({
      ok: false,
      error: "dataDo is not dd.mm.yyyy",
    });
  });

  it("test_buildSettlementRead_rows_feed_engine", () => {
    const result = read({ podwykonawca: "gpw", dataDo: "30.09.2026" }, [entry(2, { 8: 1 })], [
      { sheetRow: 2, cells: ["Sklepowa 1", "gpw", 20, 10, ""] },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const statement = settle({ rows: result.rows, rates: result.rates, screenByRow: {} });
    expect(statement.total).toBe(3_000);
    expect(statement.ties).toEqual([]);
  });
});

describe("akcje odczytu w transport-log.gs", () => {
  it("test_listContractors_reads_merged_list_without_write", () => {
    const body = functionSource("listContractors_");
    expect(body).toContain("mergeReferencePodwykoLista_");
    expect(body).not.toMatch(WRITE_CALL);
    expect(gs).toContain("action === 'listContractors'");
  });

  it("test_settlementSearch_reads_without_write_and_before_lock", () => {
    const search = functionSource("settlementSearch_");
    const reader = functionSource("readSettlementCells_");
    expect(search).toContain("buildSettlementRead_");
    expect(search).toContain("getSheetByName(RATE_SHEET_NAME)");
    expect(search).not.toMatch(WRITE_CALL);
    expect(reader).toContain("getValues");
    expect(reader).not.toMatch(WRITE_CALL);
    const post = functionSource("doPost");
    expect(post.indexOf("settlementSearch")).toBeGreaterThan(-1);
    expect(post.indexOf("settlementSearch")).toBeLessThan(post.indexOf("waitLock"));
    expect(gs).toContain("action === 'settlementSearch'");
  });
});
