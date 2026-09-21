import { describe, expect, it } from "vitest";
import { lineKey } from "./engine.js";
import type { RegisterRow } from "./types.js";
import type { SettlementRateRow } from "./search.js";
import {
  STATEMENT_ERROR,
  UNICORN_FROM_GROSZE,
  UNICORN_HOLD_MS,
  adoptRows,
  approveShow,
  attachDecision,
  bagsBody,
  buildApprove,
  commitDetach,
  currentStatement,
  freshStatement,
  parseAmountText,
  readSettlement,
  routeRateBody,
  routeSelectionKey,
  setBagRate,
  setBagsOnly,
  setDidNotHappen,
  setPickup,
  type StatementScreen,
} from "./statement.js";

function row(over: Partial<RegisterRow> & { sheetRow: number }): RegisterRow {
  return {
    transportNumber: String(over.sheetRow),
    address: "Sklepowa 1",
    shopName: "Sklep",
    pickupDate: "18.09.2026",
    contractor: "gpw",
    bagCount: 0,
    routeName: "",
    routeRate: null,
    pickupRate: 2_000,
    bagRate: 0,
    ...over,
  };
}

function rate(over: Partial<SettlementRateRow> & { sheetRow: number; shop: string }): SettlementRateRow {
  return {
    contractor: "gpw",
    pickupAmount: 2_000,
    bagAmount: 0,
    validFrom: "",
    ...over,
  };
}

function screen(rows: RegisterRow[], rates: SettlementRateRow[] = []): StatementScreen {
  return freshStatement(rows, rates);
}

describe("parseAmountText", () => {
  it("test_parseAmountText_empty_zero_and_comma_stay_grosze", () => {
    expect(parseAmountText("")).toEqual({ kind: "empty" });
    expect(parseAmountText("0")).toEqual({ kind: "grosze", value: 0 });
    expect(parseAmountText("33,33")).toEqual({ kind: "grosze", value: 3_333 });
    expect(parseAmountText("150.5")).toEqual({ kind: "grosze", value: 15_050 });
    expect(parseAmountText("-1").kind).toBe("bad");
    expect(parseAmountText("1.234").kind).toBe("bad");
  });
});

describe("approveShow", () => {
  it("test_approveShow_unicorn_from_10000_logo_below", () => {
    expect(UNICORN_HOLD_MS).toBe(3_400);
    expect(approveShow(UNICORN_FROM_GROSZE - 1)).toBe("logo");
    expect(approveShow(UNICORN_FROM_GROSZE)).toBe("unicorn");
  });
});

describe("currentStatement", () => {
  it("test_currentStatement_oneRouteName_twoDates_isOneLine", () => {
    const statement = currentStatement(
      screen(
        [
          row({ sheetRow: 2, address: "A", routeName: "trasa", routeRate: 15_000, pickupDate: "18.09.2026" }),
          row({ sheetRow: 3, address: "B", routeName: "trasa", routeRate: 15_000, pickupDate: "19.09.2026" }),
        ],
        [rate({ sheetRow: 2, shop: "A" }), rate({ sheetRow: 3, shop: "B" })],
      ),
    );
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].kind).toBe("route");
    if (statement.lines[0].kind === "route") {
      expect(statement.lines[0].date).toBeNull();
      expect(routeSelectionKey(statement.lines[0].routeName)).toBe(lineKey(statement.lines[0]));
    }
  });
});

describe("screen edits", () => {
  it("test_setPickup_and_setBagRate_stay_on_screen_rows_unchanged", () => {
    const base = screen([row({ sheetRow: 2, bagCount: 2, bagRate: 1_000 })], [rate({ sheetRow: 2, shop: "Sklepowa 1", bagAmount: 1_000 })]);
    const next = setBagRate(setPickup(base, 2, "2", 5_000), 2, "2", 250);
    expect(next.rows).toEqual(base.rows);
    expect(next.screenByRow["2\t2"]).toEqual({ pickupAmount: 5_000, bagAmount: 250 });
    expect(JSON.stringify(next)).not.toContain("saveRate");
  });

  it("test_setBagsOnly_drops_pickup_from_cost", () => {
    const next = setBagsOnly(
      screen([row({ sheetRow: 2, bagCount: 1, bagRate: 1_000 })], [rate({ sheetRow: 2, shop: "Sklepowa 1", bagAmount: 1_000 })]),
      2,
      "2",
      true,
    );
    const statement = currentStatement(next);
    const shop = statement.lines[0];
    expect(shop.kind).toBe("plain");
    if (shop.kind === "plain") {
      expect(shop.shop.bagsOnly).toBe(true);
      expect(shop.shop.legAmount).toBeNull();
      expect(shop.shop.receptionCost).toBe(1_000);
    }
  });

  it("test_setDidNotHappen_zeroes_cost_and_writes_nothing", () => {
    const base = screen(
      [row({ sheetRow: 2, address: "A", routeName: "trasa", routeRate: 15_000, bagCount: 1, bagRate: 1_000 })],
      [rate({ sheetRow: 2, shop: "A", bagAmount: 1_000 })],
    );
    const next = setDidNotHappen(base, 2, "2", true);
    expect(next.rows).toEqual(base.rows);
    const statement = currentStatement(next);
    const line = statement.lines[0];
    expect(line.kind).toBe("route");
    if (line.kind === "route") {
      expect(line.shops[0].happened).toBe(false);
      expect(line.shops[0].receptionCost).toBe(0);
      expect(line.routeSum).toBe(0);
    }
  });
});

describe("writes", () => {
  it("test_bagsBody_targets_that_row_column_count", () => {
    const built = bagsBody(row({ sheetRow: 4, transportNumber: "P4", bagCount: 1 }), "6");
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.bagCount).toBe(6);
      expect(built.body).toEqual({
        action: "patchBags",
        sheetRow: 4,
        transportNumber: "P4",
        iloscWorkow: 6,
      });
    }
  });

  it("test_routeRateBody_sends_zloty_not_grosze", () => {
    const built = routeRateBody(row({ sheetRow: 2, routeName: "trasa", routeRate: 15_000 }), "trasa", "200");
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.grosze).toBe(20_000);
      expect(built.body.stawkaTrasy).toBe("200.00");
      expect(built.body.action).toBe("patchRouteRate");
      expect(built.body).not.toHaveProperty("koszt");
    }
  });

  it("test_attachDecision_emptyRate_blocked_zero_allowed_sameName_blocked", () => {
    const shop = row({ sheetRow: 2, routeName: "" });
    expect(attachDecision(shop, "nowa", "", "stara").ok).toBe(false);
    expect(attachDecision(shop, "stara", "0", "stara")).toEqual({
      ok: false,
      error: STATEMENT_ERROR.sameRoute,
    });
    const zero = attachDecision(shop, "nowa", "0", "stara");
    expect(zero.ok).toBe(true);
    if (zero.ok) {
      expect(zero.grosze).toBe(0);
      expect(zero.body.action).toBe("attachRoute");
      expect(zero.body.stawkaTrasy).toBe("0.00");
    }
  });

  it("test_commitDetach_clears_route_and_remembers_left_name", () => {
    const next = commitDetach(
      screen([row({ sheetRow: 2, routeName: "stara", routeRate: 15_000 })]),
      2,
      "2",
    );
    expect(next?.rows[0].routeName).toBe("");
    expect(next?.rows[0].routeRate).toBeNull();
    expect(next?.leftRoute["2\t2"]).toBe("stara");
  });
});

describe("buildApprove", () => {
  it("test_buildApprove_needs_invoice_and_selection", () => {
    const base = screen([row({ sheetRow: 2 })], [rate({ sheetRow: 2, shop: "Sklepowa 1" })]);
    const statement = currentStatement(base);
    expect(buildApprove("  ", statement, { "2\t2": true }).ok).toBe(false);
    expect(buildApprove("FV/1", statement, {})).toEqual({ ok: false, error: "selection" });
    const built = buildApprove(" FV/1 ", statement, { "2\t2": true });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.body.numerFaktury).toBe("FV/1");
      expect(built.body.wiersze).toHaveLength(1);
      expect(built.body.wiersze[0].koszt).toBe(2_000);
    }
  });

  it("test_buildApprove_empty_snapshot_does_not_block_route", () => {
    const rows = [
      row({ sheetRow: 2, address: "Z" }),
      row({
        sheetRow: 3,
        address: "A",
        routeName: "trasa",
        routeRate: 15_000,
        pickupRate: null,
        bagRate: null,
      }),
      row({
        sheetRow: 4,
        address: "B",
        routeName: "trasa",
        routeRate: 15_000,
        pickupRate: null,
        bagRate: null,
      }),
    ];
    const statement = currentStatement(screen(rows, []));
    const both = buildApprove("FV/1", statement, { "2\t2": true, [routeSelectionKey("trasa")]: true });
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.body.wiersze.map((item) => item.sheetRow).sort()).toEqual([2, 3, 4]);
    }
  });

  it("test_buildApprove_didNotHappen_sends_nie_without_cost", () => {
    const next = setDidNotHappen(
      screen([row({ sheetRow: 2, bagCount: 1, bagRate: 1_000 })], [rate({ sheetRow: 2, shop: "Sklepowa 1", bagAmount: 1_000 })]),
      2,
      "2",
      true,
    );
    const built = buildApprove("FV/9", currentStatement(next), { "2\t2": true });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.body.wiersze).toEqual([
        { sheetRow: 2, transportNumber: "2", nieOdbył: true },
      ]);
    }
  });
});

describe("adoptRows", () => {
  it("test_adoptRows_drops_missing_and_keeps_screen_of_remaining", () => {
    const prev = setBagsOnly(
      screen([
        row({ sheetRow: 2, address: "Zostaje" }),
        row({ sheetRow: 3, address: "Znika" }),
      ]),
      2,
      "2",
      true,
    );
    const next = adoptRows(prev, [row({ sheetRow: 2, address: "Zostaje" })], []);
    expect(next.rows.map((item) => item.sheetRow)).toEqual([2]);
    expect(next.screenByRow["2\t2"]?.bagsOnly).toBe(true);
    expect(next.screenByRow["3\t3"]).toBeUndefined();
  });
});

describe("readSettlement", () => {
  it("test_readSettlement_requires_rows_and_rates", () => {
    expect(readSettlement({ ok: true, rows: [] }).ok).toBe(false);
    const read = readSettlement({
      ok: true,
      rows: [row({ sheetRow: 2, bagCount: null, routeRate: null, pickupRate: null, bagRate: null })],
      rates: [rate({ sheetRow: 8, shop: "Sklepowa 1", validFrom: "" })],
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.rows[0].bagCount).toBeNull();
      expect(read.rows[0].pickupRate).toBeNull();
      expect(read.rates[0].sheetRow).toBe(8);
    }
  });
});
