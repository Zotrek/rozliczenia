import { lineKey, rowKey, settle, sumSelected } from "./engine.js";
import { isoToSheetDate, type SettlementMode } from "./range.js";
import { parseSheetDate } from "./sheetDate.js";
import type {
  SettlementRateRow,
  SettlementSearchResult,
  SettlementStatsResult,
  SettlementStatsRow,
} from "./search.js";
import type {
  Grosze,
  RegisterRow,
  ScreenState,
  ShopCost,
  Statement,
  StatementLine,
} from "./types.js";

/**
 * Zestawienie. Kwoty liczy `settle`. Ten plik trzyma stan ekranu i body zapisów.
 * Drugiego wzoru kosztu tu nie ma.
 */

export const UNICORN_FROM_GROSZE = 1_000_000;
export const UNICORN_HOLD_MS = 3_400;

export const STATEMENT_ERROR = {
  invoice: "Wpisz numer faktury.",
  selection: "Zaznacz co najmniej jeden wiersz.",
  tie: "Wiersz z remisem nie wchodzi, dopóki nie wskażesz stawki.",
  routeName: "Wpisz inną nazwę trasy.",
  sameRoute: "Nazwa nie jest tą, z której sklep właśnie zszedł.",
  emptyRate: "Pusta stawka nie zapisuje trasy.",
  badRate: "Stawka jest niepoprawna.",
  badBags: "Liczba worków jest niepoprawna.",
  badDate: "Data odbioru jest niepoprawna.",
  write: "Zapis nie doszedł.",
  stale: "Wiersz się zmienił. Szukaj jeszcze raz.",
  refresh: "Zapisano, ale nie udało się odświeżyć listy.",
  partial: "Część wierszy nie weszła w zapis.",
} as const;

const SKIP_REASON_LABEL: Record<string, string> = {
  key: "wiersz się zmienił",
  settled: "już rozliczony",
  nie: "status NIE",
  date: "niespójna data",
  cost: "niespójny koszt",
  bags: "niespójna liczba worków",
  rate: "niespójna stawka",
};

export function skipReasonLabel(reason: unknown): string {
  if (typeof reason === "string" && SKIP_REASON_LABEL[reason]) {
    return SKIP_REASON_LABEL[reason];
  }
  return writeError(reason);
}

/** Lista pominiętych przy częściowym zatwierdzeniu — tekst wieloliniowy do UI. */
export function formatPartialApprove(body: unknown): string {
  const lines: string[] = [STATEMENT_ERROR.partial];
  if (!isRecord(body) || !Array.isArray(body.pominiete)) {
    return lines[0];
  }
  const saved = Array.isArray(body.zapisane) ? body.zapisane.length : 0;
  if (saved > 0) {
    lines.push(`Zapisano: ${saved}.`);
  }
  lines.push(`Pominięto (${body.pominiete.length}):`);
  for (const item of body.pominiete) {
    if (!isRecord(item)) {
      lines.push("• pozycja bez szczegółów");
      continue;
    }
    const numer = String(item.transportNumber ?? "").trim() || "?";
    const reason = skipReasonLabel(item.reason);
    const row =
      typeof item.sheetRow === "number" && item.sheetRow > 0 ? ` (wiersz ${item.sheetRow})` : "";
    lines.push(`• Transport ${numer}${row} — ${reason}`);
  }
  return lines.join("\n");
}

/** tryb=harmonogram dla zapisów na „zestawienie z harmonogramu”. */
function scheduleTrybFields(mode?: SettlementMode): Record<string, string> {
  return mode === "schedule" ? { tryb: "harmonogram" } : {};
}

export interface RouteDraft {
  name: string;
  rate: string;
}

export interface StatementScreen {
  rows: RegisterRow[];
  rates: SettlementRateRow[];
  screenByRow: Record<string, ScreenState>;
  selected: Record<string, true>;
  openRoutes: Record<string, true>;
  invoice: string;
  leftRoute: Record<string, string>;
  routeDraft: Record<string, RouteDraft>;
  routeDraftError: Record<string, string>;
}

export interface ApproveShop {
  sheetName: string;
  sheetRow: number;
  transportNumber: string;
  nieOdbył?: true;
  koszt?: number;
  stawkaPodjazdu?: string;
  stawkaWorka?: string;
}

export type ApproveBuild =
  | { ok: false; error: "invoice" | "selection" | "tie" }
  | {
      ok: true;
      body: { action: "approve"; numerFaktury: string; wiersze: ApproveShop[] };
    };

export type AmountParse = { kind: "empty" } | { kind: "grosze"; value: Grosze } | { kind: "bad" };

export function emptyStatement(): StatementScreen {
  return {
    rows: [],
    rates: [],
    screenByRow: {},
    selected: {},
    openRoutes: {},
    invoice: "",
    leftRoute: {},
    routeDraft: {},
    routeDraftError: {},
  };
}

export function freshStatement(rows: RegisterRow[], rates: SettlementRateRow[]): StatementScreen {
  return { ...emptyStatement(), rows, rates };
}

export function currentStatement(screen: StatementScreen): Statement {
  return settle({
    rows: screen.rows,
    rates: screen.rates,
    screenByRow: screen.screenByRow,
  });
}

export function selectedKeys(selected: Readonly<Record<string, true>>): Set<string> {
  return new Set(Object.keys(selected));
}

export function positionLabel(count: number): string {
  const n = Math.abs(count);
  const last = n % 10;
  const lastTwo = n % 100;
  let word = "pozycji";
  if (n === 1) {
    word = "pozycja";
  } else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    word = "pozycje";
  }
  return `${count} ${word} w zestawieniu`;
}

export function formatPln(grosze: Grosze): string {
  return `${signedAmount(grosze, ",")}\u00a0zł`;
}

export function formatAmountInput(grosze: Grosze): string {
  return signedAmount(grosze, ",");
}

export function groszeToZlotyText(grosze: Grosze): string {
  return signedAmount(grosze, ".");
}

/** Tekst z pola kwoty. Puste zostaje puste. Zero jest zerem. Ujemne odpadają. */
export function parseAmountText(text: string): AmountParse {
  const raw = text.trim().replace(/\s/g, "").replace(",", ".");
  if (raw === "") {
    return { kind: "empty" };
  }
  if (raw.startsWith("-")) {
    return { kind: "bad" };
  }
  const dot = raw.indexOf(".");
  if (dot >= 0 && raw.indexOf(".", dot + 1) >= 0) {
    return { kind: "bad" };
  }
  const whole = dot < 0 ? raw : raw.slice(0, dot);
  const frac = dot < 0 ? "" : raw.slice(dot + 1);
  if (whole === "" || !/^\d+$/.test(whole)) {
    return { kind: "bad" };
  }
  if (dot >= 0 && (frac.length === 0 || !/^\d+$/.test(frac) || frac.length > 2)) {
    return { kind: "bad" };
  }
  const grosze = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(grosze)) {
    return { kind: "bad" };
  }
  return { kind: "grosze", value: grosze };
}

export function parseBagText(
  text: string,
): { kind: "empty" } | { kind: "count"; value: number } | { kind: "bad" } {
  const raw = text.trim().replace(/\s/g, "").replace(",", ".");
  if (raw === "") {
    return { kind: "empty" };
  }
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { kind: "bad" };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { kind: "bad" };
  }
  return { kind: "count", value };
}

export function approveShow(selectedGrosze: Grosze): "logo" | "unicorn" {
  return selectedGrosze >= UNICORN_FROM_GROSZE ? "unicorn" : "logo";
}

export function canPressApprove(invoice: string, selectedCount: number): boolean {
  return invoice.trim() !== "" && selectedCount > 0;
}

export function lineHasTie(line: StatementLine): boolean {
  if (line.kind === "plain") {
    return line.shop.tie !== null;
  }
  return line.shops.some((shop) => shop.tie !== null);
}

export function routeSelectionKey(routeName: string): string {
  return `route\t${routeName}`;
}

export function readSettlement(body: unknown): SettlementSearchResult {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.rows) || !Array.isArray(body.rates)) {
    const error = isRecord(body) && typeof body.error === "string" ? body.error : "Wyszukanie nie doszło.";
    return { ok: false, error };
  }
  const rows: RegisterRow[] = [];
  for (const item of body.rows) {
    const row = readRegisterRow(item);
    if (!row) {
      return { ok: false, error: "Wyszukanie nie doszło." };
    }
    rows.push(row);
  }
  const rates: SettlementRateRow[] = [];
  for (const item of body.rates) {
    const rate = readRateRow(item);
    if (!rate) {
      return { ok: false, error: "Wyszukanie nie doszło." };
    }
    rates.push(rate);
  }
  return { ok: true, rows, rates };
}

/** Odczyt `settlementStats` — wiersze z settled/happened/P/Q. */
export function readSettlementStats(body: unknown): SettlementStatsResult {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.rows) || !Array.isArray(body.rates)) {
    const error =
      isRecord(body) && typeof body.error === "string" ? body.error : "Odczyt statystyk nie doszedł.";
    return { ok: false, error };
  }
  const rows = [];
  for (const item of body.rows) {
    const row = readStatsRow(item);
    if (!row) {
      return { ok: false, error: "Odczyt statystyk nie doszedł." };
    }
    rows.push(row);
  }
  const rates: SettlementRateRow[] = [];
  for (const item of body.rates) {
    const rate = readRateRow(item);
    if (!rate) {
      return { ok: false, error: "Odczyt statystyk nie doszedł." };
    }
    rates.push(rate);
  }
  return { ok: true, rows, rates };
}

export function findRow(
  rows: readonly RegisterRow[],
  sheetRow: number,
  transportNumber: string,
  sheetName = "",
): RegisterRow | null {
  return (
    rows.find(
      (row) =>
        row.sheetRow === sheetRow &&
        row.transportNumber === transportNumber &&
        row.sheetName === sheetName,
    ) ?? null
  );
}

export function toggleSelected(screen: StatementScreen, key: string): StatementScreen {
  const selected = { ...screen.selected };
  if (selected[key]) {
    delete selected[key];
  } else {
    selected[key] = true;
  }
  return { ...screen, selected };
}

/** Zaznacza albo czyści każdą pozycję zestawienia (sklep albo cała trasa). */
export function setAllSelected(screen: StatementScreen, on: boolean): StatementScreen {
  if (!on) {
    return { ...screen, selected: {} };
  }
  const selected: Record<string, true> = {};
  for (const line of currentStatement(screen).lines) {
    selected[lineKey(line)] = true;
  }
  return { ...screen, selected };
}

export function toggleOpen(screen: StatementScreen, routeName: string): StatementScreen {
  const openRoutes = { ...screen.openRoutes };
  if (openRoutes[routeName]) {
    delete openRoutes[routeName];
  } else {
    openRoutes[routeName] = true;
  }
  return { ...screen, openRoutes };
}

export function setDidNotHappen(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  on: boolean,
  sheetName = "",
): StatementScreen {
  return patchScreen(screen, rowKey(sheetRow, transportNumber, sheetName), { didNotHappen: on });
}

export function setPickup(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  amount: Grosze | null,
  sheetName = "",
): StatementScreen {
  return patchScreen(screen, rowKey(sheetRow, transportNumber, sheetName), { pickupAmount: amount });
}

export function setBagRate(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  amount: Grosze | null,
  sheetName = "",
): StatementScreen {
  return patchScreen(screen, rowKey(sheetRow, transportNumber, sheetName), { bagAmount: amount });
}

/** Wspólna kwota worka na ekranie, tylko sklepy trasy, które się odbyły. Do Bazy stawek nie idzie. */
export function setRouteBagRate(
  screen: StatementScreen,
  routeName: string,
  amount: Grosze | null,
): StatementScreen {
  const screenByRow = { ...screen.screenByRow };
  for (const row of screen.rows) {
    if (row.routeName !== routeName) {
      continue;
    }
    const key = rowKey(row.sheetRow, row.transportNumber, row.sheetName);
    if (screenByRow[key]?.didNotHappen) {
      continue;
    }
    screenByRow[key] = { ...screenByRow[key], bagAmount: amount };
  }
  return { ...screen, screenByRow };
}

export function commitBags(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  bagCount: number | null,
  sheetName = "",
): StatementScreen {
  return {
    ...screen,
    rows: screen.rows.map((row) =>
      row.sheetRow === sheetRow &&
      row.transportNumber === transportNumber &&
      row.sheetName === sheetName
        ? { ...row, bagCount }
        : row,
    ),
  };
}

export function commitRouteRate(
  screen: StatementScreen,
  routeName: string,
  routeRate: Grosze | null,
): StatementScreen {
  return {
    ...screen,
    rows: screen.rows.map((row) => (row.routeName === routeName ? { ...row, routeRate } : row)),
  };
}

export function commitDetach(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  sheetName = "",
): StatementScreen | null {
  const row = findRow(screen.rows, sheetRow, transportNumber, sheetName);
  if (!row || row.routeName === "") {
    return null;
  }
  const left = row.routeName;
  const rows = screen.rows.map((item) =>
    item.sheetRow === sheetRow &&
    item.transportNumber === transportNumber &&
    item.sheetName === sheetName
      ? { ...item, routeName: "", routeRate: null }
      : item,
  );
  const selected = { ...screen.selected };
  if (!rows.some((item) => item.routeName === left)) {
    delete selected[routeSelectionKey(left)];
  }
  return {
    ...screen,
    rows,
    selected,
    leftRoute: { ...screen.leftRoute, [rowKey(sheetRow, transportNumber, sheetName)]: left },
  };
}

export function commitAttach(
  screen: StatementScreen,
  sheetRow: number,
  transportNumber: string,
  name: string,
  routeRate: Grosze,
  sheetName = "",
): StatementScreen | null {
  if (!findRow(screen.rows, sheetRow, transportNumber, sheetName)) {
    return null;
  }
  const rows = screen.rows.map((item) => {
    if (
      item.sheetRow === sheetRow &&
      item.transportNumber === transportNumber &&
      item.sheetName === sheetName
    ) {
      return { ...item, routeName: name, routeRate };
    }
    if (item.routeName === name) {
      return { ...item, routeRate };
    }
    return item;
  });
  const key = rowKey(sheetRow, transportNumber, sheetName);
  const leftRoute = { ...screen.leftRoute };
  delete leftRoute[key];
  const routeDraft = { ...screen.routeDraft };
  delete routeDraft[key];
  const routeDraftError = { ...screen.routeDraftError };
  delete routeDraftError[key];
  return { ...screen, rows, leftRoute, routeDraft, routeDraftError };
}

export function withoutTiedRates(rates: readonly SettlementRateRow[], keptSheetRow: number): SettlementRateRow[] {
  const kept = rates.find((rate) => rate.sheetRow === keptSheetRow);
  if (!kept) {
    return [...rates];
  }
  return rates.filter(
    (rate) =>
      rate.sheetRow === kept.sheetRow ||
      rate.shop !== kept.shop ||
      rate.contractor !== kept.contractor ||
      rate.validFrom !== kept.validFrom,
  );
}

/** Po odświeżeniu odczytu zostaje stan ekranu wierszy, które nadal są. */
export function adoptRows(
  prev: StatementScreen,
  rows: RegisterRow[],
  rates: SettlementRateRow[],
): StatementScreen {
  const keys = new Set(rows.map((row) => rowKey(row.sheetRow, row.transportNumber, row.sheetName)));
  const routeNames = new Set(rows.map((row) => row.routeName).filter((name) => name !== ""));
  return {
    rows,
    rates,
    screenByRow: pick(prev.screenByRow, keys),
    selected: pickLines(prev.selected, keys, routeNames),
    openRoutes: pickNames(prev.openRoutes, routeNames),
    invoice: prev.invoice,
    leftRoute: pick(prev.leftRoute, keys),
    routeDraft: pick(prev.routeDraft, keys),
    routeDraftError: pick(prev.routeDraftError, keys),
  };
}

export function bagsBody(
  row: RegisterRow,
  text: string,
  mode?: SettlementMode,
): { ok: false; error: string } | { ok: true; bagCount: number | null; body: Record<string, unknown> } {
  const parsed = parseBagText(text);
  if (parsed.kind === "bad") {
    return { ok: false, error: STATEMENT_ERROR.badBags };
  }
  return {
    ok: true,
    bagCount: parsed.kind === "empty" ? null : parsed.value,
    body: {
      action: "patchBags",
      sheetName: row.sheetName,
      sheetRow: row.sheetRow,
      transportNumber: row.transportNumber,
      iloscWorkow: parsed.kind === "empty" ? "" : parsed.value,
      ...scheduleTrybFields(mode),
    },
  };
}

export function routeRateBody(
  row: RegisterRow,
  routeName: string,
  text: string,
  mode?: SettlementMode,
): { ok: false; error: string } | { ok: true; grosze: Grosze | null; body: Record<string, unknown> } {
  const parsed = parseAmountText(text);
  if (parsed.kind === "bad") {
    return { ok: false, error: STATEMENT_ERROR.badRate };
  }
  const grosze = parsed.kind === "empty" ? null : parsed.value;
  return {
    ok: true,
    grosze,
    body: {
      action: "patchRouteRate",
      sheetName: row.sheetName,
      sheetRow: row.sheetRow,
      transportNumber: row.transportNumber,
      trasa: routeName,
      stawkaTrasy: grosze === null ? "" : groszeToZlotyText(grosze),
      ...scheduleTrybFields(mode),
    },
  };
}

export function pickupDateBody(
  rows: readonly RegisterRow[],
  iso: string,
  mode?: SettlementMode,
):
  | { ok: false; error: string }
  | { ok: true; unchanged: true }
  | { ok: true; unchanged: false; pickupDate: string; body: Record<string, unknown> } {
  const pickupDate = isoToSheetDate(iso);
  if (!pickupDate || rows.length === 0) {
    return { ok: false, error: STATEMENT_ERROR.badDate };
  }
  if (rows.every((row) => row.pickupDate === pickupDate)) {
    return { ok: true, unchanged: true };
  }
  return {
    ok: true,
    unchanged: false,
    pickupDate,
    body: {
      action: "patchPickupDate",
      dataOdbioru: pickupDate,
      wiersze: rows.map((row) => ({
        sheetName: row.sheetName,
        sheetRow: row.sheetRow,
        transportNumber: row.transportNumber,
      })),
      ...scheduleTrybFields(mode),
    },
  };
}

export function detachBody(row: RegisterRow, mode?: SettlementMode): Record<string, unknown> {
  return {
    action: "detachRoute",
    sheetName: row.sheetName,
    sheetRow: row.sheetRow,
    transportNumber: row.transportNumber,
    ...scheduleTrybFields(mode),
  };
}

export function attachDecision(
  row: RegisterRow,
  nameText: string,
  rateText: string,
  leftName: string,
  mode?: SettlementMode,
): { ok: false; error: string } | { ok: true; name: string; grosze: Grosze; body: Record<string, unknown> } {
  const name = nameText.trim();
  if (name === "") {
    return { ok: false, error: STATEMENT_ERROR.routeName };
  }
  if (name === leftName.trim()) {
    return { ok: false, error: STATEMENT_ERROR.sameRoute };
  }
  const parsed = parseAmountText(rateText);
  if (parsed.kind === "empty") {
    return { ok: false, error: STATEMENT_ERROR.emptyRate };
  }
  if (parsed.kind === "bad") {
    return { ok: false, error: STATEMENT_ERROR.badRate };
  }
  return {
    ok: true,
    name,
    grosze: parsed.value,
    body: {
      action: "attachRoute",
      sheetName: row.sheetName,
      sheetRow: row.sheetRow,
      transportNumber: row.transportNumber,
      trasa: name,
      stawkaTrasy: groszeToZlotyText(parsed.value),
      ...scheduleTrybFields(mode),
    },
  };
}

export function tieBody(rateSheetRow: number): Record<string, unknown> {
  return { action: "resolveRateTie", sheetRow: rateSheetRow };
}

export function buildApprove(
  invoice: string,
  statement: Statement,
  selected: Readonly<Record<string, true>>,
  mode?: SettlementMode,
): ApproveBuild {
  const numerFaktury = invoice.trim();
  if (numerFaktury === "") {
    return { ok: false, error: "invoice" };
  }
  const chosen = statement.lines.filter((line) => selected[lineKey(line)]);
  if (chosen.length === 0) {
    return { ok: false, error: "selection" };
  }
  const wiersze: ApproveShop[] = [];
  let blocked = false;
  for (const line of chosen) {
    if (lineHasTie(line)) {
      blocked = true;
      continue;
    }
    const route = line.kind === "route";
    const shops = route ? line.shops : [line.shop];
    for (const shop of shops) {
      const item = shopItem(shop, mode === "schedule", route);
      if (!item) {
        blocked = true;
        continue;
      }
      wiersze.push(item);
    }
  }
  if (wiersze.length === 0) {
    return { ok: false, error: blocked ? "tie" : "selection" };
  }
  return {
    ok: true,
    body: { action: "approve", numerFaktury, wiersze, ...scheduleTrybFields(mode) },
  };
}

export function skippedCount(body: unknown): number {
  if (!isRecord(body) || !Array.isArray(body.pominiete)) {
    return 0;
  }
  return body.pominiete.length;
}

export function writeError(code: unknown): string {
  if (code === "key" || code === "settled" || code === "nie") {
    return STATEMENT_ERROR.stale;
  }
  if (code === "bags") {
    return STATEMENT_ERROR.badBags;
  }
  if (code === "date") {
    return STATEMENT_ERROR.badDate;
  }
  if (code === "rate") {
    return STATEMENT_ERROR.badRate;
  }
  if (code === "name") {
    return STATEMENT_ERROR.routeName;
  }
  if (code === "invoice") {
    return STATEMENT_ERROR.invoice;
  }
  if (code === "selection") {
    return STATEMENT_ERROR.selection;
  }
  return STATEMENT_ERROR.write;
}

export function selectedLineCount(statement: Statement, selected: Readonly<Record<string, true>>): number {
  return statement.lines.filter((line) => selected[lineKey(line)]).length;
}

export function statementSums(screen: StatementScreen): { total: Grosze; selected: Grosze } {
  const statement = currentStatement(screen);
  return {
    total: statement.total,
    selected: sumSelected(statement, selectedKeys(screen.selected)),
  };
}

function shopItem(shop: ShopCost, schedule = false, route = false): ApproveShop | null {
  if (!shop.happened) {
    return {
      sheetName: shop.sheetName,
      sheetRow: shop.sheetRow,
      transportNumber: shop.transportNumber,
      nieOdbył: true,
    };
  }
  if (shop.receptionCost === null) {
    return null;
  }
  const item: ApproveShop = {
    sheetName: shop.sheetName,
    sheetRow: shop.sheetRow,
    transportNumber: shop.transportNumber,
    koszt: shop.receptionCost,
  };
  if (schedule) {
    item.stawkaWorka = shop.bagRate === null ? "" : groszeToZlotyText(shop.bagRate);
    if (!route) {
      item.stawkaPodjazdu = shop.legAmount === null ? "" : groszeToZlotyText(shop.legAmount);
    }
  }
  return item;
}

function patchScreen(screen: StatementScreen, key: string, patch: ScreenState): StatementScreen {
  return {
    ...screen,
    screenByRow: {
      ...screen.screenByRow,
      [key]: { ...screen.screenByRow[key], ...patch },
    },
  };
}

function pick<T>(source: Record<string, T>, keys: ReadonlySet<string>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (keys.has(key)) {
      next[key] = value;
    }
  }
  return next;
}

function pickNames(source: Record<string, true>, names: ReadonlySet<string>): Record<string, true> {
  const next: Record<string, true> = {};
  for (const name of Object.keys(source)) {
    if (names.has(name)) {
      next[name] = true;
    }
  }
  return next;
}

function pickLines(
  selected: Record<string, true>,
  keys: ReadonlySet<string>,
  routeNames: ReadonlySet<string>,
): Record<string, true> {
  const next: Record<string, true> = {};
  for (const key of Object.keys(selected)) {
    if (key.startsWith("route\t")) {
      if (routeNames.has(key.slice("route\t".length))) {
        next[key] = true;
      }
    } else if (keys.has(key)) {
      next[key] = true;
    }
  }
  return next;
}

function signedAmount(grosze: Grosze, sep: "." | ","): string {
  const negative = grosze < 0;
  const abs = Math.abs(grosze);
  const text = `${Math.floor(abs / 100)}${sep}${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
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

function readRegisterRow(value: unknown): RegisterRow | null {
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
  const routeRate = readGrosze(value.routeRate);
  const pickupRate = readGrosze(value.pickupRate);
  const bagRate = readGrosze(value.bagRate);
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
    routeRate === undefined ||
    pickupRate === undefined ||
    bagRate === undefined
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
  const sheetName = readText(value.sheetName) ?? "";
  return {
    sheetName,
    sheetRow,
    transportNumber,
    address,
    shopName,
    pickupDate,
    contractor,
    bagCount,
    routeName,
    routeRate,
    pickupRate,
    bagRate,
  };
}

function readStatsRow(value: unknown): SettlementStatsRow | null {
  const base = readRegisterRow(value);
  if (!base || !isRecord(value)) {
    return null;
  }
  if (typeof value.settled !== "boolean" || typeof value.happened !== "boolean") {
    return null;
  }
  const receptionCost = readGrosze(value.receptionCost);
  const costPerBag = readGrosze(value.costPerBag);
  if (receptionCost === undefined || costPerBag === undefined) {
    return null;
  }
  return {
    ...base,
    settled: value.settled,
    happened: value.happened,
    receptionCost,
    costPerBag,
    mode: value.mode === "schedule" ? "schedule" : value.mode === "report" ? "report" : undefined,
  };
}

function readRateRow(value: unknown): SettlementRateRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const sheetRow = value.sheetRow;
  const shop = readText(value.shop);
  const contractor = readText(value.contractor);
  const validFrom = readText(value.validFrom);
  const pickupAmount = readGrosze(value.pickupAmount);
  const bagAmount = readGrosze(value.bagAmount);
  if (
    typeof sheetRow !== "number" ||
    !Number.isInteger(sheetRow) ||
    sheetRow < 2 ||
    shop === null ||
    contractor === null ||
    validFrom === null ||
    pickupAmount === undefined ||
    bagAmount === undefined
  ) {
    return null;
  }
  if (validFrom !== "") {
    try {
      parseSheetDate(validFrom);
    } catch {
      return null;
    }
  }
  return { sheetRow, shop, contractor, pickupAmount, bagAmount, validFrom };
}
