import { costPerBag, mulGrosze, divRoundHalfUp } from "./money.js";
import { parseSheetDate } from "./sheetDate.js";
import { resolveRate } from "./rates.js";
import type {
  EngineInput,
  Grosze,
  PlainLine,
  RateRow,
  RateTie,
  RegisterRow,
  RouteLine,
  ScreenState,
  ShopCost,
  Statement,
  StatementLine,
} from "./types.js";

/**
 * Silnik kosztów. Czyste funkcje, bez arkusza i bez DOM.
 * Kwoty w groszach. Daty tekstem `dd.mm.yyyy`.
 * Reguły: docs/SPECIFICATION.md — Koszt odbioru, Baza stawek.
 */

export function rowKey(sheetRow: number, transportNumber: string): string {
  return `${sheetRow}\t${transportNumber}`;
}

export function lineKey(line: StatementLine): string {
  if (line.kind === "plain") {
    return rowKey(line.shop.sheetRow, line.shop.transportNumber);
  }
  return `route\t${line.routeName}`;
}

export function settle(input: EngineInput): Statement {
  for (const row of input.rows) {
    parseSheetDate(row.pickupDate);
  }

  const routeRows = new Map<string, RegisterRow[]>();
  const order: Array<{ kind: "plain"; row: RegisterRow } | { kind: "route"; name: string }> = [];

  for (const row of input.rows) {
    if (row.routeName === "") {
      order.push({ kind: "plain", row });
      continue;
    }
    const group = routeRows.get(row.routeName);
    if (group) {
      group.push(row);
    } else {
      routeRows.set(row.routeName, [row]);
      order.push({ kind: "route", name: row.routeName });
    }
  }

  const lines: StatementLine[] = [];
  const ties: RateTie[] = [];
  for (const item of order) {
    if (item.kind === "plain") {
      const shop = buildShop(item.row, input, { kind: "plain" });
      if (shop.tie) {
        ties.push(shop.tie);
      }
      const line: PlainLine = { kind: "plain", shop };
      lines.push(line);
    } else {
      const line = buildRoute(routeRows.get(item.name) ?? [], input);
      for (const shop of line.shops) {
        if (shop.tie) {
          ties.push(shop.tie);
        }
      }
      lines.push(line);
    }
  }

  return { lines, total: sumLines(lines), ties };
}

/** Suma zaznaczonych wierszy tabeli. Trasa raz. Klucz sklepu z rozwinięcia nic nie dodaje. */
export function sumSelected(statement: Statement, selectedLineKeys: ReadonlySet<string>): Grosze {
  let total = 0;
  for (const line of statement.lines) {
    if (!selectedLineKeys.has(lineKey(line))) {
      continue;
    }
    total += lineAmount(line);
  }
  return total;
}

type ShopMode = { kind: "plain" } | { kind: "route"; share: Grosze };

function buildRoute(rows: readonly RegisterRow[], input: EngineInput): RouteLine {
  const happenedCount = rows.filter((row) => !screenOf(input, row).didNotHappen).length;
  const routeRate = firstRouteRate(rows);
  const routeCostApplies = happenedCount > 0;
  const share = routeCostApplies ? shareOf(routeRate, happenedCount) : 0;
  const shops = rows.map((row) => buildShop(row, input, { kind: "route", share }));
  const happened = shops.filter((shop) => shop.happened);
  const bagSum = sumBagFees(happened);
  const dates = new Set(rows.map((row) => row.pickupDate));

  return {
    kind: "route",
    routeName: rows[0]?.routeName ?? "",
    date: dates.size === 1 ? rows[0].pickupDate : null,
    routeRate,
    routeCostApplies,
    bagCount: happened.reduce((sum, shop) => sum + (shop.bagCount ?? 0), 0),
    bagRate: commonBagRate(happened),
    bagSum,
    routeSum: routeTotal(routeCostApplies, routeRate, bagSum),
    shops,
  };
}

function buildShop(row: RegisterRow, input: EngineInput, mode: ShopMode): ShopCost {
  const screen = screenOf(input, row);
  const happened = !screen.didNotHappen;
  const bagsOnly = mode.kind === "plain" && screen.bagsOnly === true;
  const priced = price(row, input.rates, screen);

  let legAmount: Grosze | null;
  let bagSum: Grosze | null;
  let receptionCost: Grosze | null;
  let perBag: Grosze | null;

  if (!happened) {
    legAmount = 0;
    bagSum = 0;
    receptionCost = 0;
    perBag = null;
  } else if (priced.tie) {
    legAmount = mode.kind === "route" ? mode.share : null;
    bagSum = null;
    receptionCost = null;
    perBag = null;
  } else if (mode.kind === "route") {
    legAmount = mode.share;
    bagSum = priced.bagSum;
    receptionCost = mode.share + priced.bagSum;
    perBag = costPerBag(receptionCost, row.bagCount);
  } else if (bagsOnly) {
    legAmount = null;
    bagSum = priced.bagSum;
    receptionCost = priced.bagSum;
    perBag = costPerBag(receptionCost, row.bagCount);
  } else {
    legAmount = priced.pickup;
    bagSum = priced.bagSum;
    receptionCost = priced.pickup + priced.bagSum;
    perBag = costPerBag(receptionCost, row.bagCount);
  }

  return {
    sheetRow: row.sheetRow,
    transportNumber: row.transportNumber,
    address: row.address,
    shopName: row.shopName,
    pickupDate: row.pickupDate,
    bagCount: row.bagCount,
    happened,
    bagsOnly,
    legAmount,
    bagRate: priced.tie ? null : priced.bagRate,
    bagSum,
    receptionCost,
    costPerBag: perBag,
    tie: priced.tie,
  };
}

interface Priced {
  tie: RateTie | null;
  pickup: Grosze;
  bagRate: Grosze | null;
  bagSum: Grosze;
}

function price(row: RegisterRow, rates: readonly RateRow[], screen: ScreenState): Priced {
  const resolved = resolveRate(rates, row.address, row.contractor, row.pickupDate);
  if (resolved.kind === "tie") {
    return { tie: resolved.tie, pickup: 0, bagRate: null, bagSum: 0 };
  }

  const basePickup = resolved.kind === "ok" ? resolved.pickupAmount : null;
  const baseBag = resolved.kind === "ok" ? resolved.bagAmount : null;
  const pickupAmount = screen.pickupAmount !== undefined ? screen.pickupAmount : basePickup;
  const bagAmount = screen.bagAmount !== undefined ? screen.bagAmount : baseBag;
  const pickup = pickupAmount ?? 0;
  const bagRate = bagAmount;
  const bagSum = bagRate === null || bagRate === 0 ? 0 : mulGrosze(row.bagCount ?? 0, bagRate);
  return { tie: null, pickup, bagRate, bagSum };
}

function screenOf(input: EngineInput, row: RegisterRow): ScreenState {
  return input.screenByRow[rowKey(row.sheetRow, row.transportNumber)] ?? {};
}

function firstRouteRate(rows: readonly RegisterRow[]): Grosze | null {
  for (const row of rows) {
    if (row.routeRate !== null) {
      return row.routeRate;
    }
  }
  return null;
}

/** Pusta albo zerowa stawka: udział 0. Wywołanie tylko, gdy ktoś się odbył — nie dzielimy przez 1. */
function shareOf(routeRate: Grosze | null, happenedCount: number): Grosze {
  if (routeRate === null || routeRate === 0) {
    return 0;
  }
  return divRoundHalfUp(routeRate, happenedCount);
}

function sumBagFees(shops: readonly ShopCost[]): Grosze | null {
  if (shops.some((shop) => shop.bagSum === null)) {
    return null;
  }
  return shops.reduce((sum, shop) => sum + (shop.bagSum ?? 0), 0);
}

function commonBagRate(happened: readonly ShopCost[]): Grosze | null {
  if (happened.length === 0 || happened.some((shop) => shop.tie !== null)) {
    return null;
  }
  const first = happened[0].bagRate;
  return happened.every((shop) => shop.bagRate === first) ? first : null;
}

function routeTotal(
  routeCostApplies: boolean,
  routeRate: Grosze | null,
  bagSum: Grosze | null,
): Grosze | null {
  if (bagSum === null) {
    return null;
  }
  if (!routeCostApplies) {
    return 0;
  }
  return (routeRate ?? 0) + bagSum;
}

function lineAmount(line: StatementLine): Grosze {
  if (line.kind === "plain") {
    return line.shop.receptionCost ?? 0;
  }
  return line.routeSum ?? 0;
}

function sumLines(lines: readonly StatementLine[]): Grosze {
  return lines.reduce((sum, line) => sum + lineAmount(line), 0);
}
