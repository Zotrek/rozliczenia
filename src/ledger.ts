import { foldPl, type SettlementMode } from "./range.js";
import type { PeriodInvoice } from "./stats.js";

/** Wszystkie = oba sposoby odbioru. */
export type LedgerMode = "all" | SettlementMode;

/** Numer (fragment) i sposób odbioru. Zakres dat i podwykonawca są już w odczycie. */
export function filterLedgerInvoices(
  rows: readonly PeriodInvoice[],
  query: string,
  mode: LedgerMode,
): PeriodInvoice[] {
  const needle = foldPl(query);
  return rows.filter((row) => {
    if (mode !== "all" && row.mode !== mode) {
      return false;
    }
    if (needle === "") {
      return true;
    }
    return foldPl(row.invoice).includes(needle);
  });
}
