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
}

export interface SettlementStatsOk {
  ok: true;
  rows: SettlementStatsRow[];
  rates: SettlementRateRow[];
}

export type SettlementStatsResult = SettlementStatsOk | SettlementSearchErr;

/** Ta sama pozycja co `listReferenceData.podwykoLista`. */
export interface ContractorListItem {
  nazwa: string;
  dane: string;
}
