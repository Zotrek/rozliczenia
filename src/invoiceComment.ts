import { rowKey } from "./engine.js";
import { groupSettledInvoices, type SettledInvoiceRow } from "./invoices.js";
import type { ShopCost, Statement } from "./types.js";

/** Sklep albo podjazd, któremu można wpisać komentarz do faktury. */
export interface CommentChoice {
  key: string;
  shopName: string;
  comment: string;
}

export interface CommentTarget extends CommentChoice {
  /** null = podjazd, nie sklep trasy. */
  routeName: string | null;
}

export interface RouteCommentFace {
  snip: string;
  sub: string;
  /** Ten sam tekst przy każdym sklepie trasy, który wchodzi na fakturę. */
  sharedByAll: boolean;
}

export interface InvoiceCommentDraft {
  comments: Record<string, string>;
  picks: Record<string, true>;
  draft: string;
  notice: string;
}

export const COMMENT_NEEDS_TEXT = "Wpisz komentarz albo zaznacz pozycję, która już go ma.";

export function emptyInvoiceComment(): InvoiceCommentDraft {
  return { comments: {}, picks: {}, draft: "", notice: "" };
}

export function commentKey(shop: Pick<ShopCost, "sheetName" | "sheetRow" | "transportNumber">): string {
  return rowKey(shop.sheetRow, shop.transportNumber, shop.sheetName);
}

/** Sklepy i podjazdy, które weszłyby na fakturę. Transport, który się nie odbył, odpada. */
export function commentTargets(
  statement: Statement,
  comments: Readonly<Record<string, string>>,
): CommentTarget[] {
  const targets: CommentTarget[] = [];
  for (const line of statement.lines) {
    if (line.kind === "plain") {
      if (line.shop.happened) {
        targets.push(targetOf(line.shop, null, comments));
      }
      continue;
    }
    for (const shop of line.shops) {
      if (shop.happened) {
        targets.push(targetOf(shop, line.routeName, comments));
      }
    }
  }
  return targets;
}

/** Na starcie zestawienia: sklepy trasy bez własnego komentarza. Podjazdy zostają odznaczone. */
export function openingCommentPicks(targets: readonly CommentTarget[]): Record<string, true> {
  const picks: Record<string, true> = {};
  for (const target of targets) {
    if (target.routeName !== null && target.comment.trim() === "") {
      picks[target.key] = true;
    }
  }
  return picks;
}

export function invoiceCommentTargets(
  rows: readonly SettledInvoiceRow[],
  comments: Readonly<Record<string, string>>,
): CommentChoice[] {
  const choices: CommentChoice[] = [];
  for (const group of groupSettledInvoices(rows)) {
    for (const row of group.rows) {
      const key = rowKey(row.sheetRow, row.transportNumber, row.sheetName);
      choices.push({
        key,
        shopName: shownShop(row.shopName, row.address),
        comment: comments[key] ?? "",
      });
    }
  }
  return choices;
}

export function retainInvoiceComment(
  state: InvoiceCommentDraft,
  rows: readonly Pick<SettledInvoiceRow, "sheetName" | "sheetRow" | "transportNumber">[],
): InvoiceCommentDraft {
  const keys = new Set(rows.map((row) => rowKey(row.sheetRow, row.transportNumber, row.sheetName)));
  return {
    comments: keepRecord(state.comments, keys),
    picks: keepRecord(state.picks, keys),
    draft: state.draft,
    notice: "",
  };
}

export function chosenComments<T extends CommentChoice>(
  targets: readonly T[],
  picks: Readonly<Record<string, true>>,
): T[] {
  return targets.filter((target) => picks[target.key] === true);
}

export function allPicked(targets: readonly { key: string }[], picks: Readonly<Record<string, true>>): boolean {
  return targets.length > 0 && targets.every((target) => picks[target.key] === true);
}

export function setCommentPicks(
  picks: Readonly<Record<string, true>>,
  keys: readonly string[],
  on: boolean,
): Record<string, true> {
  const next: Record<string, true> = { ...picks };
  for (const key of keys) {
    if (on) {
      next[key] = true;
    } else {
      delete next[key];
    }
  }
  return next;
}

export function picksForAll(targets: readonly { key: string }[], on: boolean): Record<string, true> {
  if (!on) {
    return {};
  }
  const next: Record<string, true> = {};
  for (const target of targets) {
    next[target.key] = true;
  }
  return next;
}

export function prunePicks(
  picks: Readonly<Record<string, true>>,
  targets: readonly { key: string }[],
): Record<string, true> {
  const allowed = new Set(targets.map((target) => target.key));
  return keepRecord(picks, allowed);
}

export function selectionSummary(targets: readonly CommentTarget[], picks: Readonly<Record<string, true>>): string {
  const chosen = chosenComments(targets, picks);
  if (chosen.length === 0) {
    return "Nic nie zaznaczono. Zaznacz trasę, sklep w trasie albo podjazd.";
  }
  const routeNames: string[] = [];
  const seen = new Set<string>();
  let stops = 0;
  for (const item of chosen) {
    if (item.routeName === null) {
      stops += 1;
      continue;
    }
    if (!seen.has(item.routeName)) {
      seen.add(item.routeName);
      routeNames.push(item.routeName);
    }
  }
  const parts: string[] = [];
  for (const name of routeNames) {
    const count = chosen.filter((item) => item.routeName === name).length;
    parts.push(`${sklepy(count)} · ${name}`);
  }
  if (stops > 0) {
    parts.push(podjazdy(stops));
  }
  return `Zaznaczone: ${parts.join(" i ")}.`;
}

export function invoiceSelectionSummary(count: number): string {
  if (count === 0) {
    return "Nic nie zaznaczono. Zaznacz pozycje w tabeli.";
  }
  return `Zaznaczone: ${pozycji(count)}.`;
}

export function commentsToOverwrite(chosen: readonly CommentChoice[], draft: string): CommentChoice[] {
  const trimmed = draft.trim();
  return chosen.filter((item) => item.comment.trim() !== "" && item.comment.trim() !== trimmed);
}

export function overwriteHint(list: readonly CommentChoice[], draft: string): string {
  if (list.length === 0) {
    return "";
  }
  const verb = draft.trim() === "" ? "Wyczyści istniejący komentarz" : "Nadpisze istniejący komentarz";
  if (list.length <= 3) {
    return `${verb}: ${list.map((item) => item.shopName).join(", ")}.`;
  }
  return `${verb} przy ${przy(list.length)}.`;
}

export function applyIsDisabled(draft: string, chosen: readonly CommentChoice[]): boolean {
  return chosen.length === 0 || (draft.trim() === "" && !chosen.some((item) => item.comment.trim() !== ""));
}

export function applyButtonLabel(draft: string, chosen: readonly CommentChoice[]): string {
  const clearing = draft.trim() === "" && chosen.some((item) => item.comment.trim() !== "");
  const base = clearing ? "Wyczyść na zaznaczonych" : "Wpisz na zaznaczone";
  return chosen.length === 0 ? base : `${base} (${chosen.length})`;
}

/** null = nie ma czego wpisać ani wyczyścić. */
export function applyComments(
  comments: Readonly<Record<string, string>>,
  chosen: readonly CommentChoice[],
  draft: string,
): Record<string, string> | null {
  const trimmed = draft.trim();
  if (chosen.length === 0 || (trimmed === "" && chosen.every((item) => item.comment.trim() === ""))) {
    return null;
  }
  const next: Record<string, string> = { ...comments };
  for (const item of chosen) {
    if (trimmed === "") {
      delete next[item.key];
    } else {
      next[item.key] = trimmed;
    }
  }
  return next;
}

export function commentApplyNotice(count: number, draft: string, where: "statement" | "invoice"): string {
  const verb = draft.trim() === "" ? `Wyczyszczone przy ${przy(count)}` : `Wpisane przy ${przy(count)}`;
  return where === "invoice" ? `${verb} tej faktury.` : `${verb}.`;
}

export function routePickNote(total: number, picked: number): string {
  if (picked === 0) {
    return "zaznaczenie trasy bierze jej sklepy";
  }
  if (total > 0 && picked === total) {
    return "zaznaczone wszystkie sklepy";
  }
  return `zaznaczone ${picked} z ${total}`;
}

export function routeCommentFace(shops: readonly CommentChoice[]): RouteCommentFace {
  const filled = shops.filter((shop) => shop.comment.trim() !== "");
  if (shops.length === 0 || filled.length === 0) {
    return { snip: "", sub: "brak komentarza", sharedByAll: false };
  }
  const unique = [...new Set(filled.map((shop) => shop.comment.trim()))];
  if (unique.length === 1 && filled.length === shops.length) {
    return { snip: unique[0], sub: `ten sam przy ${sklepach(shops.length)}`, sharedByAll: true };
  }
  if (unique.length === 1) {
    return { snip: unique[0], sub: `przy ${filled.length} z ${shops.length}`, sharedByAll: false };
  }
  return { snip: "", sub: `różne · ${filled.length} z ${shops.length}`, sharedByAll: false };
}

export function willOverwrite(comment: string, picked: boolean, draft: string): boolean {
  return picked && comment.trim() !== "" && comment.trim() !== draft.trim();
}

function targetOf(
  shop: ShopCost,
  routeName: string | null,
  comments: Readonly<Record<string, string>>,
): CommentTarget {
  const key = commentKey(shop);
  return {
    key,
    shopName: shownShop(shop.shopName, shop.address),
    routeName,
    comment: comments[key] ?? "",
  };
}

function shownShop(shopName: string, address: string): string {
  const name = shopName.trim();
  return name === "" ? address.trim() : name;
}

function keepRecord<T>(source: Readonly<Record<string, T>>, keys: ReadonlySet<string>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (keys.has(key)) {
      next[key] = value;
    }
  }
  return next;
}

function polish(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count);
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) {
    return `1 ${one}`;
  }
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}

function sklepy(count: number): string {
  return polish(count, "sklep", "sklepy", "sklepów");
}

function podjazdy(count: number): string {
  return polish(count, "podjazd", "podjazdy", "podjazdów");
}

function pozycji(count: number): string {
  return polish(count, "pozycja", "pozycje", "pozycji");
}

function przy(count: number): string {
  return count === 1 ? "1 pozycji" : `${count} pozycjach`;
}

function sklepach(count: number): string {
  return count === 1 ? "1 sklepie" : `${count} sklepach`;
}
