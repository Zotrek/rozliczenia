import { describe, expect, it } from "vitest";
import { lineKey, rowKey, settle, sumSelected } from "./engine.js";
import type { EngineInput, RegisterRow, RouteLine, ScreenState, ShopCost, Statement } from "./types.js";

function reception(over: Partial<RegisterRow> & Pick<RegisterRow, "sheetRow">): RegisterRow {
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
    ...over,
  };
}

function go(rows: RegisterRow[], screenByRow: EngineInput["screenByRow"] = {}): Statement {
  return settle({ rows, rates: [], screenByRow });
}

function screen(row: RegisterRow, state: ScreenState): EngineInput["screenByRow"] {
  return { [rowKey(row.sheetRow, row.transportNumber)]: state };
}

function onlyPlain(statement: Statement): ShopCost {
  expect(statement.lines).toHaveLength(1);
  const line = statement.lines[0];
  if (line.kind !== "plain") {
    throw new Error("oczekiwano odbioru zwykłego");
  }
  return line.shop;
}

function onlyRoute(statement: Statement): RouteLine {
  expect(statement.lines).toHaveLength(1);
  const line = statement.lines[0];
  if (line.kind !== "route") {
    throw new Error("oczekiwano trasy");
  }
  return line;
}

describe("settle", () => {
  it("test_settle_pickup20_bags10_cost30", () => {
    const shop = onlyPlain(go([reception({ sheetRow: 2 })]));
    expect(shop.legAmount).toBe(2_000);
    expect(shop.bagSum).toBe(1_000);
    expect(shop.receptionCost).toBe(3_000);
    expect(shop.costPerBag).toBe(3_000);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_route150_twoVisibleShops_share75_routeSum190", () => {
    const first = reception({
      sheetRow: 2,
      transportNumber: "P1",
      address: "A 1",
      routeName: "gpw-18.09.26-01",
      routeRate: 15_000,
      bagCount: 4,
      pickupRate: 2_000,
      bagRate: 1_000,
    });
    const second = reception({
      sheetRow: 3,
      transportNumber: "P2",
      address: "B 2",
      routeName: "gpw-18.09.26-01",
      routeRate: 15_000,
      bagCount: 0,
      pickupRate: 2_000,
      bagRate: 1_000,
    });
    const statement = go([first, second]);
    const line = onlyRoute(statement);
    expect(line.date).toBe("18.09.2026");
    expect(line.shops[0].legAmount).toBe(7_500);
    expect(line.shops[1].legAmount).toBe(7_500);
    expect(line.shops[0].receptionCost).toBe(11_500);
    expect(line.shops[1].receptionCost).toBe(7_500);
    expect(line.routeSum).toBe(19_000);
    expect(line.bagRate).toBe(1_000);
    expect(statement.total).toBe(19_000);
  });

  it("test_settle_route100_threeShops_share3333_sharesSum9999_routeSum10000", () => {
    const rows = [2, 3, 4].map((sheetRow) =>
      reception({
        sheetRow,
        address: `Adres ${sheetRow}`,
        routeName: "trasa",
        routeRate: 10_000,
        bagCount: 0,
        pickupRate: null,
        bagRate: null,
      }),
    );
    const line = onlyRoute(go(rows));
    expect(line.shops.map((shop) => shop.legAmount)).toEqual([3_333, 3_333, 3_333]);
    const shares = line.shops.reduce((sum, shop) => sum + (shop.receptionCost ?? 0), 0);
    expect(shares).toBe(9_999);
    expect(line.routeSum).toBe(10_000);
    expect(line.routeCostApplies).toBe(true);
  });

  it("test_settle_bagsOnly_10_leg_dash", () => {
    const row = reception({ sheetRow: 2 });
    const shop = onlyPlain(go([row], screen(row, { bagsOnly: true })));
    expect(shop.legAmount).toBeNull();
    expect(shop.bagSum).toBe(1_000);
    expect(shop.receptionCost).toBe(1_000);
    expect(shop.bagsOnly).toBe(true);
  });

  it("test_settle_route150_threeShops_oneAbsent_divisor2_share75_excluded0", () => {
    const rows = [2, 3, 4].map((sheetRow) =>
      reception({
        sheetRow,
        address: `Adres ${sheetRow}`,
        routeName: "trasa",
        routeRate: 15_000,
        bagCount: 0,
        pickupRate: null,
        bagRate: null,
      }),
    );
    const absent = rows[2];
    const line = onlyRoute(go(rows, screen(absent, { didNotHappen: true })));
    expect(line.routeCostApplies).toBe(true);
    expect(line.shops[0].legAmount).toBe(7_500);
    expect(line.shops[1].legAmount).toBe(7_500);
    expect(line.shops[2].legAmount).toBe(0);
    expect(line.shops[2].receptionCost).toBe(0);
    expect(line.shops[2].costPerBag).toBeNull();
    expect(line.shops[2].happened).toBe(false);
  });

  it("test_settle_route_noShopHappened_noRouteCost_notDividedBy1", () => {
    const rows = [2, 3, 4].map((sheetRow) =>
      reception({
        sheetRow,
        address: `Adres ${sheetRow}`,
        routeName: "trasa",
        routeRate: 15_000,
        bagCount: 1,
        bagRate: 1_000,
      }),
    );
    const screenByRow = Object.assign(
      {},
      ...rows.map((row) => screen(row, { didNotHappen: true })),
    ) as EngineInput["screenByRow"];
    const statement = go(rows, screenByRow);
    const line = onlyRoute(statement);
    expect(line.routeCostApplies).toBe(false);
    expect(line.routeRate).toBe(15_000);
    expect(line.routeSum).toBe(0);
    expect(line.shops.every((shop) => shop.legAmount === 0)).toBe(true);
    expect(line.shops.some((shop) => shop.legAmount === 15_000)).toBe(false);
    expect(statement.total).toBe(0);
  });

  it("test_settle_missingPair_0_noTie", () => {
    const shop = onlyPlain(
      go([reception({ sheetRow: 2, bagCount: 3, pickupRate: null, bagRate: null })]),
    );
    expect(shop.receptionCost).toBe(0);
    expect(shop.bagSum).toBe(0);
    expect(shop.legAmount).toBe(0);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_emptyBagRate_0_noTie", () => {
    const shop = onlyPlain(go([reception({ sheetRow: 2, bagCount: 3, bagRate: null })]));
    expect(shop.bagSum).toBe(0);
    expect(shop.bagRate).toBeNull();
    expect(shop.receptionCost).toBe(2_000);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_zeroBagRate_0_noTie", () => {
    const shop = onlyPlain(go([reception({ sheetRow: 2, bagCount: 3, bagRate: 0 })]));
    expect(shop.bagSum).toBe(0);
    expect(shop.bagRate).toBe(0);
    expect(shop.receptionCost).toBe(2_000);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_emptySnapshot_afterTieAtWrite_isZero_notError", () => {
    const statement = go([reception({ sheetRow: 2, pickupRate: null, bagRate: null })]);
    const shop = onlyPlain(statement);
    expect(shop.receptionCost).toBe(0);
    expect(shop.tie).toBeNull();
    expect(statement.ties).toHaveLength(0);
    expect(statement.total).toBe(0);
  });

  it("test_settle_snapshot_uses_register_not_rate_sheet_interval", () => {
    const shop = onlyPlain(
      go([reception({ sheetRow: 2, pickupDate: "11.10.2026", bagCount: 0, pickupRate: 20_000, bagRate: 0 })]),
    );
    expect(shop.receptionCost).toBe(20_000);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_costPerBag_nullCount_divides_by_1", () => {
    const shop = onlyPlain(go([reception({ sheetRow: 2, bagCount: null })]));
    expect(shop.receptionCost).toBe(2_000);
    expect(shop.costPerBag).toBe(2_000);
  });

  it("test_settle_costPerBag_zeroCount_divides_by_1", () => {
    const line = onlyRoute(
      go([
        reception({
          sheetRow: 2,
          routeName: "trasa",
          routeRate: 15_000,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
      ]),
    );
    expect(line.shops[0].receptionCost).toBe(15_000);
    expect(line.shops[0].costPerBag).toBe(15_000);
  });

  it("test_settle_routeShop_excludes_pickup", () => {
    const line = onlyRoute(
      go([
        reception({
          sheetRow: 2,
          routeName: "trasa",
          routeRate: 15_000,
          bagCount: 0,
          pickupRate: 10_000,
          bagRate: 0,
        }),
      ]),
    );
    expect(line.shops[0].receptionCost).toBe(15_000);
    expect(line.shops[0].legAmount).toBe(15_000);
  });

  it("test_settle_emptyRouteRate_share0", () => {
    const line = onlyRoute(
      go([
        reception({
          sheetRow: 2,
          address: "A",
          routeName: "trasa",
          routeRate: null,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
        reception({
          sheetRow: 3,
          address: "B",
          routeName: "trasa",
          routeRate: null,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
      ]),
    );
    expect(line.routeCostApplies).toBe(true);
    expect(line.routeRate).toBeNull();
    expect(line.shops.every((shop) => shop.legAmount === 0)).toBe(true);
    expect(line.routeSum).toBe(0);
  });

  it("test_settle_zeroRouteRate_share0", () => {
    const line = onlyRoute(
      go([
        reception({
          sheetRow: 2,
          routeName: "trasa",
          routeRate: 0,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
      ]),
    );
    expect(line.routeCostApplies).toBe(true);
    expect(line.routeRate).toBe(0);
    expect(line.shops[0].legAmount).toBe(0);
  });

  it("test_settle_pickupDate_is_dd_mm_yyyy_text", () => {
    expect(() => go([reception({ sheetRow: 2, pickupDate: "2026-09-18" })])).toThrow(/dd\.mm\.yyyy/);
  });

  it("test_settle_snapshot_is_per_address_not_shop_name", () => {
    const statement = go([
      reception({
        sheetRow: 2,
        address: "A 1",
        shopName: "Lewiatan",
        bagCount: 0,
        pickupRate: 2_000,
        bagRate: 0,
      }),
      reception({
        sheetRow: 3,
        address: "B 2",
        shopName: "Lewiatan",
        bagCount: 0,
        pickupRate: 10_000,
        bagRate: 0,
      }),
    ]);
    expect(statement.lines).toHaveLength(2);
    const costs = statement.lines.map((line) => (line.kind === "plain" ? line.shop.receptionCost : null));
    expect(costs).toEqual([2_000, 10_000]);
  });

  it("test_settle_route_differentDays_date_dash", () => {
    const line = onlyRoute(
      go([
        reception({
          sheetRow: 2,
          address: "A",
          pickupDate: "18.09.2026",
          routeName: "trasa",
          routeRate: 15_000,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
        reception({
          sheetRow: 3,
          address: "B",
          pickupDate: "19.09.2026",
          routeName: "trasa",
          routeRate: 15_000,
          bagCount: 0,
          pickupRate: null,
          bagRate: null,
        }),
      ]),
    );
    expect(line.date).toBeNull();
    expect(line.shops[0].legAmount).toBe(7_500);
  });

  it("test_settle_screenBagOverride_0_replaces_register_noTie", () => {
    const row = reception({ sheetRow: 2 });
    const shop = onlyPlain(go([row], screen(row, { bagAmount: 0 })));
    expect(shop.bagSum).toBe(0);
    expect(shop.receptionCost).toBe(2_000);
    expect(shop.tie).toBeNull();
  });

  it("test_settle_total_and_sumSelected_count_route_once", () => {
    const plain = reception({ sheetRow: 2, address: "Zwykly" });
    const first = reception({
      sheetRow: 3,
      address: "A",
      routeName: "trasa",
      routeRate: 15_000,
      bagCount: 4,
      bagRate: 1_000,
    });
    const second = reception({
      sheetRow: 4,
      address: "B",
      routeName: "trasa",
      routeRate: 15_000,
      bagCount: 0,
      bagRate: 1_000,
    });
    const statement = go([plain, first, second]);
    expect(statement.total).toBe(3_000 + 19_000);
    const routeLine = statement.lines.find((line) => line.kind === "route");
    if (!routeLine || routeLine.kind !== "route") {
      throw new Error("brak trasy");
    }
    expect(sumSelected(statement, new Set([rowKey(plain.sheetRow, plain.transportNumber)]))).toBe(3_000);
    expect(sumSelected(statement, new Set([lineKey(routeLine)]))).toBe(19_000);
    expect(
      sumSelected(
        statement,
        new Set([rowKey(first.sheetRow, first.transportNumber), lineKey(routeLine)]),
      ),
    ).toBe(19_000);
  });
});
