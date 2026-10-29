import { lineKey } from "./engine.js";
import { commentKey, routeCommentFace } from "./invoiceComment.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";
import { compareSheetDate, hasSheetDateShape } from "./sheetDate.js";
import { foldPl } from "./range.js";
import {
  formatPln,
  positionLabel,
  type StatementColumnKey,
  type StatementScreen,
} from "./statement.js";
import type { Grosze, PlainLine, RouteLine, ShopCost, Statement, StatementLine } from "./types.js";

const CELL_DASH = "—";

export const STATEMENT_COLUMNS: readonly {
  key: StatementColumnKey;
  label: string;
  numeric: boolean;
}[] = [
  { key: "settled", label: "Rozliczone", numeric: false },
  { key: "protocol", label: "Numer protokołu", numeric: false },
  { key: "address", label: "Adres", numeric: false },
  { key: "shop", label: "Sklep", numeric: false },
  { key: "date", label: "Data", numeric: false },
  { key: "kind", label: "Podjazd/Trasa", numeric: false },
  { key: "leg", label: "Kwota podjazdu/trasy", numeric: true },
  { key: "bags", label: "Liczba worków", numeric: true },
  { key: "bagRate", label: "Kwota za worek", numeric: true },
  { key: "bagSum", label: "Suma za worki", numeric: true },
  { key: "total", label: "Razem", numeric: true },
  { key: "happened", label: "transport się odbył", numeric: false },
  { key: "comment", label: "Komentarz do faktury", numeric: false },
];

const NUMERIC_KEYS = new Set<StatementColumnKey>(["leg", "bags", "bagRate", "bagSum", "total"]);

type Face =
  | { role: "plain"; line: PlainLine }
  | { role: "route"; line: RouteLine }
  | { role: "child"; line: RouteLine; shop: ShopCost };

export type VisibleStatementLine =
  | { kind: "plain"; line: PlainLine }
  | { kind: "route"; line: RouteLine; shops: ShopCost[] };

export function statementQueryHits(text: string, query: string): boolean {
  const folded = foldPl(query);
  if (folded === "") {
    return true;
  }
  return foldPl(text).includes(folded);
}

export function statementSortPhrase(key: StatementColumnKey, dir: "asc" | "desc"): string {
  if (key === "date") {
    return dir === "asc" ? "Sortuj od najstarszych" : "Sortuj od najnowszych";
  }
  if (NUMERIC_KEYS.has(key)) {
    return dir === "asc" ? "Sortuj od najmniejszych" : "Sortuj od największych";
  }
  return dir === "asc" ? "Sortuj od A do Z" : "Sortuj od Z do A";
}

export function statementCountLabel(visible: number, total: number): string {
  if (visible === total) {
    return positionLabel(total);
  }
  return `${visible} z ${total} pozycji w zestawieniu`;
}

/** Tekst komórki, ten sam w tabeli i na liście filtra. Kwoty z „zł”, jak w kolumnach sum. */
export function statementCellText(
  screen: StatementScreen,
  face: Face,
  key: StatementColumnKey,
): string {
  if (key === "settled") {
    if (face.role === "child") {
      return CELL_DASH;
    }
    return screen.selected[lineKey(face.line)] === true ? "tak" : "nie";
  }
  const shop = shopOf(face);
  if (key === "protocol") {
    return shop ? textOrDash(shop.transportNumber) : CELL_DASH;
  }
  if (key === "address") {
    if (face.role === "route") {
      return textOrDash(face.line.routeName);
    }
    return shop ? textOrDash(addressWithCommaAfterLocality(shop.address)) : CELL_DASH;
  }
  if (key === "shop") {
    return shop ? textOrDash(shop.shopName) : CELL_DASH;
  }
  if (key === "date") {
    if (face.role === "route") {
      return textOrDash(face.line.date ?? "");
    }
    return shop ? textOrDash(shop.pickupDate) : CELL_DASH;
  }
  if (key === "kind") {
    if (face.role === "route") {
      return "trasa";
    }
    if (!shop || face.role === "child" || shop.tie || !shop.happened) {
      return CELL_DASH;
    }
    return "podjazd";
  }
  if (key === "leg") {
    if (face.role === "child") {
      return CELL_DASH;
    }
    if (face.role === "route") {
      return statementMoneyText(face.line.routeRate);
    }
    return !shop || shop.tie ? CELL_DASH : statementMoneyText(shop.legAmount);
  }
  if (key === "bags") {
    if (face.role === "route") {
      return String(face.line.bagCount);
    }
    return !shop || shop.bagCount === null ? CELL_DASH : String(shop.bagCount);
  }
  if (key === "bagRate") {
    if (face.role === "route") {
      return statementMoneyText(face.line.bagRate);
    }
    if (!shop || shop.tie || (face.role === "child" && face.line.bagRate !== null)) {
      return CELL_DASH;
    }
    return statementMoneyText(shop.bagRate);
  }
  if (key === "bagSum") {
    if (face.role === "child" || !shop) {
      return face.role === "route" ? statementMoneyText(face.line.bagSum) : CELL_DASH;
    }
    return statementMoneyText(shop.bagSum);
  }
  if (key === "total") {
    if (face.role === "route") {
      return statementMoneyText(face.line.routeSum);
    }
    if (face.role === "child" || !shop) {
      return CELL_DASH;
    }
    return statementMoneyText(shop.receptionCost);
  }
  if (key === "happened") {
    if (!shop) {
      return CELL_DASH;
    }
    return shop.happened ? "odbył się" : "nie odbył się";
  }
  if (face.role === "route") {
    return routeCommentLabel(screen, face.line);
  }
  return shop ? shopCommentLabel(screen, shop) : CELL_DASH;
}

export function statementColumnChoices(
  screen: StatementScreen,
  statement: Statement,
  column: StatementColumnKey,
): string[] {
  const rest = { ...screen.table.filters };
  delete rest[column];
  const first = new Map<string, Face>();
  for (const line of statement.lines) {
    for (const face of lineFaces(line)) {
      if (!faceMatches(screen, face, rest)) {
        continue;
      }
      const label = statementCellText(screen, face, column);
      if (!first.has(label)) {
        first.set(label, face);
      }
    }
  }
  return [...first.entries()]
    .sort((a, b) => {
      const aBlank = isBlank(statementCellText(screen, a[1], column));
      const bBlank = isBlank(statementCellText(screen, b[1], column));
      if (aBlank !== bBlank) {
        return aBlank ? 1 : -1;
      }
      return compareFaces(screen, a[1], b[1], column) || a[0].localeCompare(b[0], "pl");
    })
    .map(([label]) => label);
}

export function visibleStatementLines(screen: StatementScreen, statement: Statement): VisibleStatementLine[] {
  const filters = screen.table.filters;
  const matched = statement.lines.filter((line) => lineVisible(screen, line, filters));
  const sorted = sortLines(screen, matched, screen.table.sortKey, screen.table.sortDir);
  return sorted.map((line) => {
    if (line.kind === "plain") {
      return { kind: "plain", line };
    }
    return { kind: "route", line, shops: shownShops(screen, line, filters) };
  });
}

function lineVisible(
  screen: StatementScreen,
  line: StatementLine,
  filters: StatementScreen["table"]["filters"],
): boolean {
  if (!hasFilter(filters)) {
    return true;
  }
  return lineFaces(line).some((face) => faceMatches(screen, face, filters));
}

function shownShops(
  screen: StatementScreen,
  line: RouteLine,
  filters: StatementScreen["table"]["filters"],
): ShopCost[] {
  if (!hasFilter(filters) || faceMatches(screen, { role: "route", line }, filters)) {
    return [...line.shops];
  }
  return line.shops.filter((shop) => faceMatches(screen, { role: "child", line, shop }, filters));
}

function sortLines(
  screen: StatementScreen,
  lines: readonly StatementLine[],
  sortKey: StatementColumnKey | null,
  sortDir: "asc" | "desc",
): StatementLine[] {
  if (sortKey === null) {
    return [...lines];
  }
  const key = sortKey;
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const aFace = primaryFace(a.line);
      const bFace = primaryFace(b.line);
      const aBlank = isBlank(statementCellText(screen, aFace, key));
      const bBlank = isBlank(statementCellText(screen, bFace, key));
      if (aBlank !== bBlank) {
        return aBlank ? 1 : -1;
      }
      const cmp = compareFaces(screen, aFace, bFace, key);
      if (cmp === 0) {
        return a.index - b.index;
      }
      return sortDir === "asc" ? cmp : -cmp;
    })
    .map((item) => item.line);
}

function faceMatches(
  screen: StatementScreen,
  face: Face,
  filters: StatementScreen["table"]["filters"],
): boolean {
  const active = (Object.keys(filters) as StatementColumnKey[]).filter((key) => filters[key] != null);
  if (active.length === 0) {
    return true;
  }
  return active.every((key) => {
    const allowed = filters[key];
    return allowed != null && allowed.includes(statementCellText(screen, face, key));
  });
}

function lineFaces(line: StatementLine): Face[] {
  if (line.kind === "plain") {
    return [{ role: "plain", line }];
  }
  return [{ role: "route", line }, ...line.shops.map((shop) => ({ role: "child" as const, line, shop }))];
}

function primaryFace(line: StatementLine): Face {
  return line.kind === "plain" ? { role: "plain", line } : { role: "route", line };
}

function hasFilter(filters: StatementScreen["table"]["filters"]): boolean {
  return (Object.keys(filters) as StatementColumnKey[]).some((key) => filters[key] != null);
}

function compareFaces(screen: StatementScreen, a: Face, b: Face, key: StatementColumnKey): number {
  if (key === "date") {
    return compareSheetDate(dateValue(screen, a), dateValue(screen, b));
  }
  if (NUMERIC_KEYS.has(key)) {
    return (faceNumber(a, key) ?? 0) - (faceNumber(b, key) ?? 0);
  }
  return statementCellText(screen, a, key).localeCompare(statementCellText(screen, b, key), "pl", {
    numeric: true,
    sensitivity: "base",
  });
}

function dateValue(screen: StatementScreen, face: Face): string {
  const text = statementCellText(screen, face, "date");
  return hasSheetDateShape(text) ? text : "";
}

function shopOf(face: Face): ShopCost | null {
  if (face.role === "child") {
    return face.shop;
  }
  if (face.role === "plain") {
    return face.line.shop;
  }
  return null;
}

function faceNumber(face: Face, key: StatementColumnKey): number | null {
  const shop = shopOf(face);
  if (key === "bags") {
    if (face.role === "route") {
      return face.line.bagCount;
    }
    return shop ? shop.bagCount : null;
  }
  if (key === "leg") {
    if (face.role === "route") {
      return face.line.routeRate;
    }
    if (!shop || face.role === "child" || shop.tie) {
      return null;
    }
    return shop.legAmount;
  }
  if (key === "bagRate") {
    if (face.role === "route") {
      return face.line.bagRate;
    }
    if (!shop || shop.tie || (face.role === "child" && face.line.bagRate !== null)) {
      return null;
    }
    return shop.bagRate;
  }
  if (key === "bagSum") {
    if (face.role === "route") {
      return face.line.bagSum;
    }
    return shop && face.role === "plain" ? shop.bagSum : null;
  }
  if (key === "total") {
    if (face.role === "route") {
      return face.line.routeSum;
    }
    return shop && face.role === "plain" ? shop.receptionCost : null;
  }
  return null;
}

function routeCommentLabel(screen: StatementScreen, line: RouteLine): string {
  const shops = line.shops.filter((shop) => shop.happened);
  if (shops.length === 0) {
    return CELL_DASH;
  }
  const face = routeCommentFace(
    shops.map((shop) => ({
      key: commentKey(shop),
      shopName: shop.shopName,
      comment: screen.invoiceComments[commentKey(shop)] ?? "",
    })),
  );
  return face.sharedByAll ? face.snip : face.sub;
}

function shopCommentLabel(screen: StatementScreen, shop: ShopCost): string {
  if (!shop.happened) {
    return CELL_DASH;
  }
  const text = (screen.invoiceComments[commentKey(shop)] ?? "").trim();
  return text === "" ? "brak" : text;
}

function statementMoneyText(value: Grosze | null): string {
  return value === null ? CELL_DASH : formatPln(value);
}

function textOrDash(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? CELL_DASH : trimmed;
}

function isBlank(text: string): boolean {
  return text === CELL_DASH;
}
