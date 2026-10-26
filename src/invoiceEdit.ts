import { rowKey, settle } from "./engine.js";
import type { SettledInvoiceRow } from "./invoices.js";
import type { SettlementMode } from "./range.js";
import {
  formatAmountInput,
  groszeToZlotyText,
  parseAmountText,
  parseBagText,
} from "./statement.js";
import type { Grosze, RegisterRow, ShopCost } from "./types.js";

/** Edycja pozycji faktury. Zostaje na ekranie, dopóki nie ma Zapisz zmiany. */
export interface InvoiceEditDraft {
  bags: Record<string, string>;
  pickup: Record<string, string>;
  bagRate: Record<string, string>;
  /** Po nazwie trasy. Jedna kwota dla sklepów tej trasy na tej fakturze. */
  routeRate: Record<string, string>;
  detached: Record<string, true>;
  notice: string;
  status: string;
}

export interface InvoiceEditLine {
  bagText: string;
  pickupText: string;
  bagRateText: string;
  routeText: string;
  bagBad: boolean;
  pickupBad: boolean;
  bagRateBad: boolean;
  routeBad: boolean;
  detached: boolean;
  receptionCost: Grosze | null;
  costPerBag: Grosze | null;
}

export interface InvoiceEditFace {
  dirty: boolean;
  invalid: boolean;
  error: string;
  /** Suma sklepów, które zostają na fakturze. */
  total: Grosze | null;
  leaving: number;
  lines: Record<string, InvoiceEditLine>;
}

const BAG_ERROR = "Liczba worków jest niepoprawna.";
const RATE_ERROR = "Stawka jest niepoprawna.";

export function emptyInvoiceEdit(): InvoiceEditDraft {
  return {
    bags: {},
    pickup: {},
    bagRate: {},
    routeRate: {},
    detached: {},
    notice: "",
    status: "",
  };
}

export function invoiceEditFace(
  rows: readonly SettledInvoiceRow[],
  draft: InvoiceEditDraft,
): InvoiceEditFace {
  return assess(rows, draft).face;
}

export function invoiceEditBody(
  rows: readonly SettledInvoiceRow[],
  draft: InvoiceEditDraft,
  invoice: string,
  mode?: SettlementMode,
):
  | { ok: false; error: string }
  | { ok: true; unchanged: true }
  | { ok: true; unchanged: false; body: Record<string, unknown> } {
  const assessed = assess(rows, draft);
  if (assessed.face.invalid) {
    return { ok: false, error: assessed.face.error };
  }
  if (!assessed.face.dirty || assessed.wiersze.length === 0) {
    return { ok: true, unchanged: true };
  }
  return {
    ok: true,
    unchanged: false,
    body: {
      action: "patchInvoiceEdit",
      numerFaktury: invoice.trim(),
      wiersze: assessed.wiersze,
      ...(mode === "schedule" ? { tryb: "harmonogram" } : {}),
    },
  };
}

interface AmountRead {
  bad: boolean;
  text: string;
  value: Grosze | null;
  changed: boolean;
}

interface BagRead {
  bad: boolean;
  text: string;
  value: number | null;
  changed: boolean;
}

interface Assessed {
  face: InvoiceEditFace;
  wiersze: Record<string, unknown>[];
}

function assess(rows: readonly SettledInvoiceRow[], draft: InvoiceEditDraft): Assessed {
  const parsed = rows.map((row) => parseRow(row, draft));
  const invalid = parsed.find((item) => item.bad);
  const shareChanged = new Set<string>();
  for (const item of parsed) {
    if (item.row.routeName !== "" && (item.detached || item.route.changed)) {
      shareChanged.add(item.row.routeName);
    }
  }
  const staying = parsed.filter((item) => !item.detached);
  const costs = invalid
    ? new Map<string, ShopCost>()
    : shopCosts(staying.map((item) => registerOf(item)));
  const lines: Record<string, InvoiceEditLine> = {};
  const wiersze: Record<string, unknown>[] = [];
  let total = 0;
  let anyCost = false;
  let dirty = false;
  for (const item of parsed) {
    const key = rowKey(item.row.sheetRow, item.row.transportNumber, item.row.sheetName);
    const shop = costs.get(key);
    const write =
      !item.bad &&
      (item.detached ||
        item.bags.changed ||
        item.pickup.changed ||
        item.bag.changed ||
        (item.row.routeName !== "" && (shareChanged.has(item.row.routeName) || item.route.changed)));
    const receptionCost = !item.detached && write && shop ? shop.receptionCost : item.row.receptionCost;
    const costPerBag = !item.detached && write && shop ? shop.costPerBag : item.row.costPerBag;
    if (!item.detached && receptionCost != null) {
      total += receptionCost;
      anyCost = true;
    }
    if (write) {
      dirty = true;
      wiersze.push(item.detached ? detachItem(item.row) : editItem(item, receptionCost));
    }
    lines[key] = {
      bagText: item.bags.text,
      pickupText: item.pickup.text,
      bagRateText: item.bag.text,
      routeText: item.route.text,
      bagBad: item.bags.bad,
      pickupBad: item.pickup.bad,
      bagRateBad: item.bag.bad,
      routeBad: item.route.bad,
      detached: item.detached,
      receptionCost,
      costPerBag,
    };
  }
  return {
    face: {
      dirty: invalid ? false : dirty,
      invalid: invalid != null,
      error: invalid ? invalid.error : "",
      total: anyCost ? total : null,
      leaving: parsed.filter((item) => item.detached).length,
      lines,
    },
    wiersze: invalid ? [] : wiersze,
  };
}

interface ParsedInvoiceRow {
  row: SettledInvoiceRow;
  detached: boolean;
  bad: boolean;
  error: string;
  bags: BagRead;
  pickup: AmountRead;
  bag: AmountRead;
  route: AmountRead;
}

function parseRow(row: SettledInvoiceRow, draft: InvoiceEditDraft): ParsedInvoiceRow {
  const key = rowKey(row.sheetRow, row.transportNumber, row.sheetName);
  const bags = readBags(draft.bags[key], row.bagCount);
  const pickup = readAmount(draft.pickup[key], row.pickupRate ?? null);
  const bag = readAmount(draft.bagRate[key], row.bagRate ?? null);
  const route =
    row.routeName === ""
      ? { bad: false, text: "", value: null, changed: false }
      : readAmount(draft.routeRate[row.routeName], row.routeRate ?? null);
  const bad = bags.bad || pickup.bad || bag.bad || route.bad;
  let error = "";
  if (bags.bad) {
    error = BAG_ERROR;
  } else if (pickup.bad || bag.bad || route.bad) {
    error = RATE_ERROR;
  }
  return {
    row,
    detached: draft.detached[key] === true,
    bad,
    error,
    bags,
    pickup,
    bag,
    route,
  };
}

function readBags(text: string | undefined, sheet: number | null): BagRead {
  if (text === undefined) {
    return {
      bad: false,
      text: sheet === null ? "" : String(sheet),
      value: sheet,
      changed: false,
    };
  }
  const parsed = parseBagText(text);
  if (parsed.kind === "bad") {
    return { bad: true, text, value: sheet, changed: false };
  }
  const value = parsed.kind === "empty" ? null : parsed.value;
  return { bad: false, text, value, changed: value !== sheet };
}

function readAmount(text: string | undefined, sheet: Grosze | null): AmountRead {
  if (text === undefined) {
    return {
      bad: false,
      text: sheet === null ? "" : formatAmountInput(sheet),
      value: sheet,
      changed: false,
    };
  }
  const parsed = parseAmountText(text);
  if (parsed.kind === "bad") {
    return { bad: true, text, value: sheet, changed: false };
  }
  const value = parsed.kind === "empty" ? null : parsed.value;
  return { bad: false, text, value, changed: value !== sheet };
}

function registerOf(item: ParsedInvoiceRow): RegisterRow {
  return {
    sheetName: item.row.sheetName,
    sheetRow: item.row.sheetRow,
    transportNumber: item.row.transportNumber,
    address: item.row.address,
    shopName: item.row.shopName,
    pickupDate: item.row.pickupDate,
    contractor: item.row.contractor,
    bagCount: item.bags.value,
    routeName: item.row.routeName,
    routeRate: item.row.routeName === "" ? null : item.route.value,
    pickupRate: item.pickup.value,
    bagRate: item.bag.value,
    invoiceComment: item.row.invoiceComment,
  };
}

function shopCosts(rows: readonly RegisterRow[]): Map<string, ShopCost> {
  const statement = settle({ rows, rates: [], screenByRow: {} });
  const costs = new Map<string, ShopCost>();
  for (const line of statement.lines) {
    const shops = line.kind === "plain" ? [line.shop] : line.shops;
    for (const shop of shops) {
      costs.set(rowKey(shop.sheetRow, shop.transportNumber, shop.sheetName), shop);
    }
  }
  return costs;
}

function detachItem(row: SettledInvoiceRow): Record<string, unknown> {
  return {
    sheetName: row.sheetName,
    sheetRow: row.sheetRow,
    transportNumber: row.transportNumber,
    odepnij: true,
  };
}

function editItem(item: ParsedInvoiceRow, cost: Grosze | null): Record<string, unknown> {
  const body: Record<string, unknown> = {
    sheetName: item.row.sheetName,
    sheetRow: item.row.sheetRow,
    transportNumber: item.row.transportNumber,
    iloscWorkow: item.bags.value === null ? "" : item.bags.value,
    stawkaPodjazdu: moneyText(item.pickup.value),
    stawkaWorka: moneyText(item.bag.value),
    koszt: cost ?? 0,
  };
  if (item.row.routeName !== "") {
    body.stawkaTrasy = moneyText(item.route.value);
  }
  return body;
}

function moneyText(grosze: Grosze | null): string {
  return grosze === null ? "" : groszeToZlotyText(grosze);
}
