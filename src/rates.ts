import { compareSheetDate, parseSheetDate, rateCoversPickup } from "./sheetDate.js";
import type { Grosze, RateCandidate, RateRow, RateTie } from "./types.js";

export type ResolvedRate =
  | { kind: "none" }
  | { kind: "ok"; pickupAmount: number | null; bagAmount: number | null }
  | { kind: "tie"; tie: RateTie };

/**
 * Który wiersz Bazy stawek obowiązuje w dniu odbioru.
 * Pusta data początku jest starsza niż każda wpisana. Wygrywa najpóźniejsza data nie późniejsza niż odbiór.
 * Puste „do kiedy” nie zamyka wiersza. Wpisana data to ostatni dzień włącznie.
 * Dwa wiersze tej daty początku to remis, nie 0 zł. Starszy dublet, który przegrywa z późniejszą datą, nie blokuje.
 */
function coveringWinners(
  rates: readonly RateRow[],
  shop: string,
  contractor: string,
  pickupDate: string,
): { rate: RateRow; index: number }[] {
  parseSheetDate(pickupDate);
  const matching = rates
    .map((rate, index) => ({ rate, index }))
    .filter(
      (entry) =>
        entry.rate.shop === shop &&
        entry.rate.contractor === contractor &&
        rateCoversPickup(entry.rate.validFrom, entry.rate.validUntil, pickupDate),
    );

  if (matching.length === 0) {
    return [];
  }

  let bestFrom = matching[0].rate.validFrom;
  for (const entry of matching) {
    if (compareSheetDate(entry.rate.validFrom, bestFrom) > 0) {
      bestFrom = entry.rate.validFrom;
    }
  }

  return matching.filter((entry) => entry.rate.validFrom === bestFrom);
}

export function resolveRate(
  rates: readonly RateRow[],
  shop: string,
  contractor: string,
  pickupDate: string,
): ResolvedRate {
  const winners = coveringWinners(rates, shop, contractor, pickupDate);
  if (winners.length === 0) {
    return { kind: "none" };
  }

  const bestFrom = winners[0].rate.validFrom;
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

/** Jedna obowiązująca stawka. Brak pary i remis nie dają kwoty do porównania. */
export function soleCatalogRate(
  rates: readonly RateRow[],
  shop: string,
  contractor: string,
  pickupDate: string,
): RateRow | null {
  const winners = coveringWinners(rates, shop, contractor, pickupDate);
  return winners.length === 1 ? winners[0].rate : null;
}

/** Kwota z bazy, gdy arkusz i baza mają wpis i te wpisy się różnią. Puste i zero równe zeru nie ostrzegają. */
export function sheetRateDrift(sheet: Grosze | null, baza: Grosze | null | undefined): Grosze | null {
  if (sheet === null || baza == null || sheet === baza) {
    return null;
  }
  return baza;
}
