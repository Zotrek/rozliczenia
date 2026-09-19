import { describe, expect, it } from "vitest";
import { buildPage } from "../scripts/build-page.mjs";
import type { RegisterRow } from "./types.js";
import type { SettlementRateRow } from "./search.js";
import {
  commitDetach,
  formatPln,
  freshStatement,
  routeSelectionKey,
  setBagsOnly,
  setDidNotHappen,
  type StatementScreen,
} from "./statement.js";
import { renderStatement } from "./statementView.js";

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

function screen(
  rows: RegisterRow[],
  rates: SettlementRateRow[] = [],
  over: Partial<StatementScreen> = {},
): StatementScreen {
  return { ...freshStatement(rows, rates), ...over };
}

describe("renderStatement", () => {
  it("test_renderStatement_bagsOnly_under_shop_name_dash_in_leg", () => {
    const html = renderStatement(
      setBagsOnly(
        screen([row({ sheetRow: 2, bagCount: 1 })], [rate({ sheetRow: 2, shop: "Sklepowa 1", bagAmount: 1_000 })]),
        2,
        "2",
        true,
      ),
    );
    expect(html).toContain("tylko za liczbę worków");
    expect(html).not.toContain('data-edit="pickup"');
    expect(html).toContain('<span class="muted">—</span>');
  });

  it("test_renderStatement_route_has_no_bags_only_and_date_dash_when_days_differ", () => {
    const html = renderStatement(
      screen(
        [
          row({ sheetRow: 2, address: "A", routeName: "trasa", routeRate: 15_000, pickupDate: "18.09.2026" }),
          row({ sheetRow: 3, address: "B", routeName: "trasa", routeRate: 15_000, pickupDate: "19.09.2026" }),
        ],
        [rate({ sheetRow: 2, shop: "A" }), rate({ sheetRow: 3, shop: "B" })],
      ),
    );
    expect(html.split('data-kind="route"').length - 1).toBe(1);
    expect(html).not.toContain("tylko za liczbę worków");
    expect(html).not.toContain("nie odbył się");
    expect(html).toContain('data-out="route-date"><span class="muted">—</span>');
    expect(html).toContain('data-edit="route-rate"');
  });

  it("test_renderStatement_expand_edits_bags_on_that_shop", () => {
    const html = renderStatement(
      screen(
        [
          row({ sheetRow: 4, address: "A", transportNumber: "P4", routeName: "trasa", routeRate: 15_000, bagCount: 2 }),
          row({ sheetRow: 5, address: "B", routeName: "trasa", routeRate: 15_000 }),
        ],
        [rate({ sheetRow: 2, shop: "A" }), rate({ sheetRow: 3, shop: "B" })],
        { openRoutes: { trasa: true } },
      ),
    );
    expect(html).toContain('data-kind="child"');
    expect(html).toContain('data-edit="bags" data-sheet-row="4" data-transport="P4"');
    expect(html).toContain("odepnij od trasy");
    expect(html).not.toContain("tylko za liczbę worków");
  });

  it("test_renderStatement_sums_count_route_once_not_shop_shares", () => {
    const rows = [2, 3, 4].map((sheetRow) =>
      row({
        sheetRow,
        address: `A${sheetRow}`,
        routeName: "trasa",
        routeRate: 10_000,
      }),
    );
    const rates = rows.map((item) => rate({ sheetRow: item.sheetRow + 10, shop: item.address }));
    const html = renderStatement(
      screen(rows, rates, { selected: { [routeSelectionKey("trasa")]: true }, invoice: "FV/1" }),
    );
    expect(html).toContain(`data-out="sum-all">${formatPln(10_000)}`);
    expect(html).toContain(`data-out="sum-sel">${formatPln(10_000)}`);
    expect(html).toContain('data-out="sel-count">1<');
    expect(html).not.toContain("99,99");
    expect(html).toContain("Zatwierdź");
    expect(html).not.toContain("disabled");
  });

  it("test_renderStatement_didNotHappen_strikes_row_before_save", () => {
    const html = renderStatement(
      setDidNotHappen(
        screen([row({ sheetRow: 2, bagCount: 1 })], [rate({ sheetRow: 2, shop: "Sklepowa 1", bagAmount: 1_000 })]),
        2,
        "2",
        true,
      ),
    );
    expect(html).toContain("is-dead");
    expect(html).toContain("strike");
    expect(html).toContain(formatPln(0));
    expect(html).not.toContain("patchBags");
  });

  it("test_renderStatement_tie_buttons_use_rate_sheet_row", () => {
    const html = renderStatement(
      screen(
        [row({ sheetRow: 3, address: "A" })],
        [
          rate({ sheetRow: 5, shop: "A", pickupAmount: 1_000, bagAmount: 100 }),
          rate({ sheetRow: 6, shop: "A", pickupAmount: 2_000, bagAmount: 200 }),
        ],
      ),
    );
    expect(html).toContain('data-action="resolve-tie" data-rate-row="5"');
    expect(html).toContain('data-action="resolve-tie" data-rate-row="6"');
    expect(html).not.toContain('data-rate-row="3"');
  });

  it("test_renderStatement_detached_shop_can_start_a_new_route", () => {
    const detached = commitDetach(screen([row({ sheetRow: 2, routeName: "stara", routeRate: 1_000 })]), 2, "2");
    const html = renderStatement(detached ?? screen([]));
    expect(html).toContain("tylko za liczbę worków");
    expect(html).toContain("odpięty od stara");
    expect(html).toContain('data-action="attach"');
    expect(html).not.toContain('data-kind="route"');
  });

  it("test_renderStatement_approve_disabled_without_invoice", () => {
    const html = renderStatement(
      screen([row({ sheetRow: 2 })], [rate({ sheetRow: 2, shop: "Sklepowa 1" })], {
        selected: { "2\t2": true },
      }),
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Suma zestawienia");
    expect(html).toContain("Suma zaznaczonych");
  });
});

describe("buildPage", () => {
  it("test_buildPage_statement_uses_engine_and_unicorn_not_a_chart", () => {
    const html = buildPage();
    expect(html).toContain("function settle");
    expect(html).toContain("function sumSelected");
    expect(html).toContain("jednorozec-deba.gif");
    expect(html).toContain("logo.png");
    expect(html).not.toContain("mix-bar");
  });
});
