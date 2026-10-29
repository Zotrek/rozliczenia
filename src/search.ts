import type { SettlementMode } from "./range.js";
import type { Grosze, RateRow, RegisterRow } from "./types.js";

/** Wiersz Bazy stawek z odczytu. `sheetRow` rozróżnia remis — para i data są wtedy te same. */
export interface SettlementRateRow extends RateRow {
  sheetRow: number;
}

export interface SettlementSearchOk {
  ok: true;
  rows: RegisterRow[];
  rates: SettlementRateRow[];
}

export interface SettlementSearchErr {
  ok: false;
  error: string;
}

export type SettlementSearchResult = SettlementSearchOk | SettlementSearchErr;

/**
 * Wiersz rejestru z `settlementStats`.
 * Agregacje biorą `settled` / `happened` / P / Q; silnik — resztę jak `RegisterRow`.
 */
export interface SettlementStatsRow extends RegisterRow {
  settled: boolean;
  happened: boolean;
  receptionCost: Grosze | null;
  costPerBag: Grosze | null;
  /**
   * Numer faktury z arkusza. `null`, gdy odczyt go nie przysłał.
   * Pusty tekst = rozliczony bez numeru.
   */
  invoice: string | null;
  /** Brak / report = Na zgłoszenie; schedule = z „odebrane z harmonogramu”. */
  mode?: SettlementMode;
  /** Data zatwierdzenia, `dd.mm.yyyy`. Pusty tekst = brak. */
  approvedDate?: string;
}

export interface SettlementStatsOk {
  ok: true;
  rows: SettlementStatsRow[];
  rates: SettlementRateRow[];
  /** Rozliczone wiersze rejestru Harmonogram. Brak pola w starym odczycie = pusta lista. */
  scheduleRows?: SettlementStatsRow[];
}

export type SettlementStatsResult = SettlementStatsOk | SettlementSearchErr;

/** Ta sama pozycja co `listReferenceData.podwykoLista`. */
export interface ContractorListItem {
  nazwa: string;
  dane: string;
}
