import type { RateRow, RegisterRow } from "./types.js";

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

/** Ta sama pozycja co `listReferenceData.podwykoLista`. */
export interface ContractorListItem {
  nazwa: string;
  dane: string;
}
