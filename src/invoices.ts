import { compareSheetDate, parseSheetDate } from "./sheetDate.js";
import type { Grosze } from "./types.js";

/** Wiersz już rozliczony. Koszt jest z arkusza, w groszach. */
export interface SettledInvoiceRow {
  sheetName: string;
  sheetRow: number;
  transportNumber: string;
  address: string;
  shopName: string;
  pickupDate: string;
  contractor: string;
  bagCount: number | null;
  routeName: string;
  /** Pusty tekst = w arkuszu nie ma numeru. */
  invoice: string;
  receptionCost: Grosze | null;
  costPerBag: Grosze | null;
}

export interface InvoiceGroup {
  /** Tekst numeru. Pusty, gdy w arkuszu go nie było. */
  invoice: string;
  /** Podpis grupy. Pusty numer czyta się „bez numeru”. */
  label: string;
  rows: SettledInvoiceRow[];
  /** null, gdy żaden wiersz nie ma kosztu. */
  total: Grosze | null;
}

export type SettledInvoicesResult =
  | { ok: true; rows: SettledInvoiceRow[] }
  | { ok: false; error: string };

/** Podpis numeru. Pusty tekst czyta się „bez numeru”. */
export function invoiceFocusLabel(invoice: string): string {
  const trimmed = invoice.trim();
  return trimmed === "" ? "bez numeru" : trimmed;
}

/** Wiersze jednego numeru. Porównanie jest po obciętych spacjach. */
export function rowsOfInvoice(rows: readonly SettledInvoiceRow[], invoice: string): SettledInvoiceRow[] {
  const key = invoice.trim();
  return rows.filter((row) => row.invoice.trim() === key);
}

export function invoiceCountLabel(count: number): string {
  const n = Math.abs(count);
  const lastTwo = n % 100;
  const last = n % 10;
  let word = "pozycji";
  if (n === 1) {
    word = "pozycja";
  } else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    word = "pozycje";
  }
  return `${count} ${word}`;
}

/** Grupy po numerze faktury. Pusty numer na końcu. W grupie: data, potem wiersz arkusza. */
export function groupSettledInvoices(rows: readonly SettledInvoiceRow[]): InvoiceGroup[] {
  const buckets = new Map<string, SettledInvoiceRow[]>();
  for (const row of rows) {
    const key = row.invoice.trim();
    const list = buckets.get(key);
    if (list) {
      list.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }
  const groups: InvoiceGroup[] = [];
  for (const [invoice, items] of buckets) {
    const sorted = [...items].sort(compareInvoiceRows);
    groups.push({
      invoice,
      label: invoice === "" ? "bez numeru" : invoice,
      rows: sorted,
      total: sumCosts(sorted),
    });
  }
  groups.sort((a, b) => {
    if (a.invoice === "" && b.invoice !== "") {
      return 1;
    }
    if (b.invoice === "" && a.invoice !== "") {
      return -1;
    }
    return a.invoice.localeCompare(b.invoice, "pl", { numeric: true, sensitivity: "base" });
  });
  return groups;
}

export function readSettledInvoices(body: unknown): SettledInvoicesResult {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.rows)) {
    const error = isRecord(body) && typeof body.error === "string" ? body.error : "Odczyt faktur nie doszedł.";
    return { ok: false, error };
  }
  const rows: SettledInvoiceRow[] = [];
  for (const item of body.rows) {
    const row = readSettledInvoiceRow(item);
    if (!row) {
      return { ok: false, error: "Odczyt faktur nie doszedł." };
    }
    rows.push(row);
  }
  return { ok: true, rows };
}

function sumCosts(rows: readonly SettledInvoiceRow[]): Grosze | null {
  let total = 0;
  let any = false;
  for (const row of rows) {
    if (row.receptionCost == null) {
      continue;
    }
    total += row.receptionCost;
    any = true;
  }
  return any ? total : null;
}

function compareInvoiceRows(a: SettledInvoiceRow, b: SettledInvoiceRow): number {
  const byDate = compareSheetDate(a.pickupDate, b.pickupDate);
  if (byDate !== 0) {
    return byDate;
  }
  if (a.sheetRow !== b.sheetRow) {
    return a.sheetRow - b.sheetRow;
  }
  return a.transportNumber.localeCompare(b.transportNumber, "pl", { numeric: true });
}

function readSettledInvoiceRow(value: unknown): SettledInvoiceRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const sheetRow = value.sheetRow;
  const transportNumber = readText(value.transportNumber);
  const address = readText(value.address);
  const shopName = readText(value.shopName);
  const pickupDate = readText(value.pickupDate);
  const contractor = readText(value.contractor);
  const routeName = readText(value.routeName);
  const invoice = readText(value.invoice);
  const receptionCost = readGrosze(value.receptionCost);
  const costPerBag = readGrosze(value.costPerBag);
  if (
    typeof sheetRow !== "number" ||
    !Number.isInteger(sheetRow) ||
    sheetRow < 2 ||
    transportNumber === null ||
    address === null ||
    shopName === null ||
    pickupDate === null ||
    contractor === null ||
    routeName === null ||
    invoice === null ||
    receptionCost === undefined ||
    costPerBag === undefined
  ) {
    return null;
  }
  let bagCount: number | null;
  if (value.bagCount === null) {
    bagCount = null;
  } else if (typeof value.bagCount === "number" && Number.isFinite(value.bagCount) && value.bagCount >= 0) {
    bagCount = value.bagCount;
  } else {
    return null;
  }
  try {
    parseSheetDate(pickupDate);
  } catch {
    return null;
  }
  return {
    sheetName: readText(value.sheetName) ?? "",
    sheetRow,
    transportNumber,
    address,
    shopName,
    pickupDate,
    contractor,
    bagCount,
    routeName,
    invoice: invoice.trim(),
    receptionCost,
    costPerBag,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readGrosze(value: unknown): Grosze | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return undefined;
}
