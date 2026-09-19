import type { ContractorListItem } from "./search.js";
import { compareSheetDate, parseSheetDate } from "./sheetDate.js";

export type { ContractorListItem };

const PL_FOLD: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RANGE_ERROR = {
  contractor: "Wybierz podwykonawcę z listy.",
  end: "Data końcowa jest wymagana.",
  order: "Data początkowa nie może być późniejsza niż końcowa.",
} as const;

export type RangeError = keyof typeof RANGE_ERROR;

export type ScreenId = "range" | "statement";

export interface RangeFields {
  /** Nazwa krótka z listy albo pusty tekst, gdy wpis nie jest pozycją listy. */
  contractor: string;
  /** `yyyy-mm-dd` z pola daty albo `""`. */
  from: string;
  /** `yyyy-mm-dd` albo `""`. */
  to: string;
}

export interface RangeDraft extends RangeFields {
  noFrom: boolean;
}

export interface HeldFrom {
  from: string;
  held: string;
}

export interface StartedSearch {
  ok: true;
  podwykonawca: string;
  /** Tekst `dd.mm.yyyy`. Brak, gdy nie ma daty początkowej. */
  dataOd?: string;
  /** Tekst `dd.mm.yyyy`. Granica włącznie. */
  dataDo: string;
}

export interface BlockedSearch {
  ok: false;
  error: RangeError;
}

export function foldPl(text: string): string {
  return text
    .toLocaleLowerCase("pl")
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_FOLD[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

/** Fragment Nazwa albo Dane do Worda. Pusty tekst zostawia całą listę. */
export function matchingContractors(
  list: readonly ContractorListItem[],
  query: string,
  browsingAll: boolean,
): ContractorListItem[] {
  if (browsingAll) {
    return [...list];
  }
  const folded = foldPl(query);
  if (folded === "") {
    return [...list];
  }
  return list.filter(
    (item) => foldPl(item.nazwa).includes(folded) || foldPl(item.dane).includes(folded),
  );
}

/** Wybór jest z listy. Do rozliczenia wchodzi Nazwa, nie Dane do Worda. */
export function selectedContractor(
  list: readonly ContractorListItem[],
  text: string,
): ContractorListItem | null {
  const folded = foldPl(text);
  if (folded === "") {
    return null;
  }
  return list.find((item) => foldPl(item.nazwa) === folded) ?? null;
}

/** `yyyy-mm-dd` → `dd.mm.yyyy`. Zły dzień kalendarza daje null. Bez przesunięcia strefy. */
export function isoToSheetDate(iso: string): string | null {
  const match = ISO_DATE.exec(iso);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const sheet = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${String(year)}`;
  try {
    parseSheetDate(sheet);
  } catch {
    return null;
  }
  return sheet;
}

export function fieldsForSearch(draft: RangeDraft): RangeFields {
  return {
    contractor: draft.contractor,
    from: draft.noFrom ? "" : draft.from,
    to: draft.to,
  };
}

/**
 * Szukaj nie startuje bez podwykonawcy z listy, bez daty końcowej
 * ani gdy data początkowa jest późniejsza niż końcowa.
 * Obie granice wychodzą jako ten sam dzień kalendarzowy, włącznie.
 */
export function startSearch(
  fields: RangeFields,
  list: readonly ContractorListItem[],
): StartedSearch | BlockedSearch {
  const picked = selectedContractor(list, fields.contractor);
  if (!picked) {
    return { ok: false, error: "contractor" };
  }
  const dataDo = isoToSheetDate(fields.to);
  if (!dataDo) {
    return { ok: false, error: "end" };
  }
  if (fields.from !== "") {
    const dataOd = isoToSheetDate(fields.from);
    if (!dataOd || compareSheetDate(dataOd, dataDo) > 0) {
      return { ok: false, error: "order" };
    }
    return { ok: true, podwykonawca: picked.nazwa, dataOd, dataDo };
  }
  return { ok: true, podwykonawca: picked.nazwa, dataDo };
}

/** Czy para dat sama z siebie blokuje Szukaj. Pusta data końcowa to inny błąd. */
export function blocksOnOrder(from: string, to: string, noFrom: boolean): boolean {
  if (noFrom || from === "") {
    return false;
  }
  const dataDo = isoToSheetDate(to);
  if (!dataDo) {
    return false;
  }
  const dataOd = isoToSheetDate(from);
  if (!dataOd) {
    return true;
  }
  return compareSheetDate(dataOd, dataDo) > 0;
}

/** Zaznaczenie czyści datę. Zdjęcie przywraca ostatnią wpisaną. */
export function applyNoStartDate(state: HeldFrom, checked: boolean): HeldFrom {
  if (checked) {
    return {
      from: "",
      held: state.from !== "" ? state.from : state.held,
    };
  }
  return { from: state.held, held: state.held };
}

export function screenAfterSearch(): ScreenId {
  return "statement";
}

export function screenAfterChangeRange(): ScreenId {
  return "range";
}

/** Baza stawek jest oknem na bieżącym ekranie, nie trzecim ekranem. */
export function openRatesWindow<T extends ScreenId>(screen: T): { screen: T; window: "rates" } {
  return { screen, window: "rates" };
}

export function reportMode(): { report: true; schedule: false } {
  return { report: true, schedule: false };
}

export function rangeLabel(query: StartedSearch): string {
  const from = query.dataOd ? `od ${query.dataOd}` : "bez daty początkowej";
  return `${query.podwykonawca}, ${from} do ${query.dataDo}`;
}

export function searchParams(query: StartedSearch): Record<string, string> {
  const params: Record<string, string> = {
    action: "settlementSearch",
    podwykonawca: query.podwykonawca,
    dataDo: query.dataDo,
  };
  if (query.dataOd) {
    params.dataOd = query.dataOd;
  }
  return params;
}

export function webAppUrl(base: string, params: Record<string, string>): string {
  const trimmed = base.trim();
  const sep = trimmed.includes("?") ? "&" : "?";
  return trimmed + sep + new URLSearchParams(params).toString();
}

/** Adres odczytu z `?webapp=`, inaczej z pamięci strony. */
export function readWebAppUrl(
  search: string,
  stored: string | null,
): { url: string; persist: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromQuery = params.get("webapp")?.trim() ?? "";
  if (fromQuery !== "") {
    return { url: fromQuery, persist: fromQuery };
  }
  return { url: stored?.trim() ?? "", persist: null };
}
