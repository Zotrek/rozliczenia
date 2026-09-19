import { compareSheetDate, isOnOrBefore, parseSheetDate } from "./sheetDate.js";
import type { RateCandidate, RateRow, RateTie } from "./types.js";

export type ResolvedRate =
  | { kind: "none" }
  | { kind: "ok"; pickupAmount: number | null; bagAmount: number | null }
  | { kind: "tie"; tie: RateTie };

/**
 * Który wiersz Bazy stawek obowiązuje w dniu odbioru.
 * Pusta data jest starsza niż każda wpisana. Wygrywa najpóźniejsza data nie późniejsza niż odbiór.
 * Dwa wiersze tej daty to remis, nie 0 zł. Starszy dublet, który przegrywa z późniejszą datą, nie blokuje.
 */
export function resolveRate(
  rates: readonly RateRow[],
  shop: string,
  contractor: string,
  pickupDate: string,
): ResolvedRate {
  parseSheetDate(pickupDate);
  const matching = rates
    .map((rate, index) => ({ rate, index }))
    .filter(
      (entry) =>
        entry.rate.shop === shop &&
        entry.rate.contractor === contractor &&
        isOnOrBefore(entry.rate.validFrom, pickupDate),
    );

  if (matching.length === 0) {
    return { kind: "none" };
  }

  let bestFrom = matching[0].rate.validFrom;
  for (const entry of matching) {
    if (compareSheetDate(entry.rate.validFrom, bestFrom) > 0) {
      bestFrom = entry.rate.validFrom;
    }
  }

  const winners = matching.filter((entry) => entry.rate.validFrom === bestFrom);
  if (winners.length > 1) {
    const candidates: RateCandidate[] = winners.map((entry) => ({
      index: entry.index,
      validFrom: entry.rate.validFrom,
      pickupAmount: entry.rate.pickupAmount,
      bagAmount: entry.rate.bagAmount,
    }));
    return {
      kind: "tie",
      tie: { shop, contractor, validFrom: bestFrom, candidates },
    };
  }

  return {
    kind: "ok",
    pickupAmount: winners[0].rate.pickupAmount,
    bagAmount: winners[0].rate.bagAmount,
  };
}
