import { describe, expect, it } from "vitest";
import type { RegisterRow } from "./types.js";
import { currentStatement, freshStatement, type StatementScreen } from "./statement.js";
import { statementColumnChoices, statementCountLabel, visibleStatementLines } from "./statementTable.js";

function row(over: Partial<RegisterRow> & { sheetRow: number }): RegisterRow {
  return {
    sheetName: "",
    transportNumber: String(over.sheetRow),
    address: "Sklepowa 1",
    shopName: "Sklep",
    pickupDate: "18.09.2026",
    contractor: "gpw",
    bagCount: 1,
    routeName: "",
    routeRate: null,
    pickupRate: 2_000,
    bagRate: 0,
    invoiceComment: "",
    ...over,
  };
}

function withTable(screen: StatementScreen, table: Partial<StatementScreen["table"]>): StatementScreen {
  return { ...screen, table: { ...screen.table, ...table } };
}

describe("visibleStatementLines", () => {
  const rows = [
    row({ sheetRow: 2, address: "A", shopName: "Alfa", routeName: "trasa", routeRate: 10_000, pickupDate: "18.09.2026" }),
    row({ sheetRow: 3, address: "B", shopName: "Beta", routeName: "trasa", routeRate: 10_000, pickupDate: "18.09.2026" }),
    row({ sheetRow: 4, address: "C", shopName: "Ced", pickupDate: "19.09.2026", bagCount: 4 }),
    row({ sheetRow: 5, address: "D", shopName: "Daga", pickupDate: "17.09.2026", bagCount: null }),
  ];

  function opened(): StatementScreen {
    return freshStatement(rows, []);
  }

  it("test_visibleStatementLines_keeps_order_without_a_filter", () => {
    const lines = visibleStatementLines(opened(), currentStatement(opened()));
    expect(lines.map((item) => (item.kind === "route" ? item.line.routeName : item.line.shop.shopName))).toEqual([
      "trasa",
      "Ced",
      "Daga",
    ]);
  });

  it("test_visibleStatementLines_shop_filter_keeps_route_and_only_the_matching_shop", () => {
    const screen = withTable(opened(), { filters: { shop: ["Beta"] } });
    const lines = visibleStatementLines(screen, currentStatement(screen));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.kind).toBe("route");
    if (lines[0]?.kind === "route") {
      expect(lines[0].shops.map((shop) => shop.shopName)).toEqual(["Beta"]);
    }
  });

  it("test_visibleStatementLines_kind_podjazd_drops_the_route", () => {
    const screen = withTable(opened(), { filters: { kind: ["podjazd"] } });
    const lines = visibleStatementLines(screen, currentStatement(screen));
    expect(lines.map((item) => (item.kind === "plain" ? item.line.shop.shopName : item.line.routeName))).toEqual([
      "Ced",
      "Daga",
    ]);
  });

  it("test_visibleStatementLines_kind_trasa_keeps_every_shop", () => {
    const screen = withTable(opened(), { filters: { kind: ["trasa"] } });
    const lines = visibleStatementLines(screen, currentStatement(screen));
    expect(lines).toHaveLength(1);
    if (lines[0]?.kind === "route") {
      expect(lines[0].shops.map((shop) => shop.shopName)).toEqual(["Alfa", "Beta"]);
    }
  });

  it("test_visibleStatementLines_and_filters_need_one_face_to_match_both", () => {
    const screen = withTable(opened(), { filters: { kind: ["podjazd"], shop: ["Beta"] } });
    expect(visibleStatementLines(screen, currentStatement(screen))).toHaveLength(0);
  });

  it("test_visibleStatementLines_sorts_dates_ascending_and_leaves_blanks_last", () => {
    const dated = freshStatement(
      [
        row({ sheetRow: 2, shopName: "Środek", pickupDate: "19.09.2026" }),
        row({ sheetRow: 3, address: "A", shopName: "Raz", routeName: "mieszana", pickupDate: "20.09.2026" }),
        row({ sheetRow: 6, address: "B", shopName: "Dwa", routeName: "mieszana", pickupDate: "21.09.2026" }),
        row({ sheetRow: 4, shopName: "Początek", pickupDate: "17.09.2026" }),
      ],
      [],
    );
    const screen = withTable(dated, { sortKey: "date", sortDir: "asc" });
    const lines = visibleStatementLines(screen, currentStatement(screen));
    expect(lines.map((item) => (item.kind === "plain" ? item.line.shop.shopName : item.line.routeName))).toEqual([
      "Początek",
      "Środek",
      "mieszana",
    ]);
  });

  it("test_visibleStatementLines_sorts_bags_descending_with_empty_last", () => {
    const screen = withTable(opened(), { filters: { kind: ["podjazd"] }, sortKey: "bags", sortDir: "desc" });
    const lines = visibleStatementLines(screen, currentStatement(screen));
    expect(lines.map((item) => (item.kind === "plain" ? item.line.shop.shopName : ""))).toEqual(["Ced", "Daga"]);
  });

  it("test_statementColumnChoices_shop_list_follows_the_other_filters", () => {
    const screen = withTable(opened(), { filters: { kind: ["podjazd"] } });
    expect(statementColumnChoices(screen, currentStatement(screen), "shop")).toEqual(["Ced", "Daga"]);
  });

  it("test_statementCountLabel_names_the_hidden_rows", () => {
    expect(statementCountLabel(2, 2)).toBe("2 pozycje w zestawieniu");
    expect(statementCountLabel(1, 31)).toBe("1 z 31 pozycji w zestawieniu");
  });
});
