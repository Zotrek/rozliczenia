import { settle } from "./engine.js";
import { divRoundHalfUp } from "./money.js";
import { isoToSheetDate, type SettlementMode } from "./range.js";
import { resolveRate } from "./rates.js";
import type { SettlementRateRow } from "./search.js";
import {
  compareSheetDate,
  hasSheetDateShape,
  parseSheetDate,
  type CalendarDate,
} from "./sheetDate.js";
import type { Grosze, RateCandidate, RateTie, RegisterRow } from "./types.js";

/** Wiersz rejestru pod statystyki (status N/R + zapisane P/Q). */
export interface StatsRow extends RegisterRow {
  /** Kol. 14 / N — `tak` = rozliczony. */
  settled: boolean;
  /** Kol. 18 / R — nie-`nie` = odbyty. */
  happened: boolean;
  /** Kol. 16 / P. */
  receptionCost: Grosze | null;
  /** Kol. 17 / Q. */
  costPerBag: Grosze | null;
  /**
   * Sposób zlecenia. Brak / undefined = Na zgłoszenie
   * (do czasu kolumny trybu w rejestrze).
   */
  mode?: SettlementMode;
}

export interface SheetDateRange {
  /** `dd.mm.yyyy`, włącznie. */
  from: string;
  /** `dd.mm.yyyy`, włącznie. */
  to: string;
}

export interface StatsFilters {
  range: SheetDateRange;
  /** Pusty / brak = wszyscy. */
  contractor?: string;
  /**
   * Dzień „dziś” do oznaczenia niedomkniętego bucketa (tydzień/miesiąc zawierający tę datę).
   * Brak = żaden bucket nie jest incomplete.
   */
  asOf?: CalendarDate;
}

export interface BacklogStats {
  count: number;
  estimate: Grosze;
}

export interface SettledStats {
  count: number;
  receptionSum: Grosze;
}

export interface AvgQStats {
  average: Grosze | null;
  sampleCount: number;
}

export interface QRankEntry {
  address: string;
  shopName: string;
  pickupDate: string;
  contractor: string;
  bagCount: number;
  costPerBag: Grosze;
}

export interface QRankStats {
  expensive: QRankEntry[];
  cheap: QRankEntry[];
}

export type RateGapKind = "emptyPickup" | "emptyBag" | "tie";

export interface RateGapEntry {
  address: string;
  shopName: string;
  contractor: string;
  pickupDate: string;
  kind: RateGapKind;
  tie: RateTie | null;
}

export interface RateGapsStats {
  entries: RateGapEntry[];
  emptySnapshotCount: number;
  tieCount: number;
  total: number;
}

export interface PeriodActivityStats {
  /** Zrealizowane wiersze w okresie (także nierozliczone). */
  pickupCount: number;
  /** Różne adresy wśród tych odbiorów. */
  uniqueShopCount: number;
}

export type TimeBucketGranularity = "week" | "month";

export interface TimeSeriesBucket {
  /** Krótka etykieta (wykres / tabela). */
  label: string;
  /** Początek bucketa przycięty do filtra, `dd.mm.yyyy`. */
  from: string;
  /** Koniec bucketa przycięty do filtra, `dd.mm.yyyy`. */
  to: string;
  report: number;
  schedule: number;
  total: number;
  /**
   * Okres jeszcze trwa (zawiera `asOf`) — liczby mogą wzrosnąć.
   * Pełne przeszłe buckety = false.
   */
  incomplete: boolean;
}

export interface TimeSeriesStats {
  granularity: TimeBucketGranularity;
  buckets: TimeSeriesBucket[];
}

export interface ContractorRankEntry {
  contractor: string;
  average: Grosze;
  pickupCount: number;
  /** Suma worków w odbiorach z rankingu (worki > 0). */
  bagCount: number;
}

export interface ContractorRankStats {
  /** Średni koszt odbioru (P) na podwykonawcę. */
  byShop: { expensive: ContractorRankEntry[]; cheap: ContractorRankEntry[] };
  /** Średni koszt za worek (Q) na podwykonawcę. */
  byBag: { expensive: ContractorRankEntry[]; cheap: ContractorRankEntry[] };
}

export interface ZeroBagPickup {
  address: string;
  shopName: string;
  contractor: string;
  pickupDate: string;
  settled: boolean;
  receptionCost: Grosze | null;
}

/** Odbiór w okresie (rejestr albo worki z harmonogramu). */
export interface PeriodPickup {
  address: string;
  shopName: string;
  contractor: string;
  pickupDate: string;
  bagCount: number | null;
  mode: SettlementMode;
  settled: boolean;
}

/** Próg inkluzywnej długości okresu: ≤ → tygodnie, inaczej miesiące. */
export const TIME_SERIES_WEEK_MAX_DAYS = 45;

const MS_DAY = 86_400_000;

/** `CalendarDate` → tekst arkusza `dd.mm.yyyy`. */
export function formatSheetDate(date: CalendarDate): string {
  return `${String(date.day).padStart(2, "0")}.${String(date.month).padStart(2, "0")}.${date.year}`;
}

/** Od 1. dnia bieżącego miesiąca do dziś (włącznie). */
export function currentMonthPeriod(today: CalendarDate): SheetDateRange {
  return {
    from: formatSheetDate({ year: today.year, month: today.month, day: 1 }),
    to: formatSheetDate(today),
  };
}

/** Pełny miesiąc kalendarzowy. `month` = 1..12. */
export function calendarMonthPeriod(year: number, month: number): SheetDateRange {
  return {
    from: formatSheetDate({ year, month, day: 1 }),
    to: formatSheetDate({ year, month, day: daysInMonth(year, month) }),
  };
}

/** Numer kwartału 1..4 dla miesiąca 1..12. */
export function calendarQuarter(month: number): number {
  return Math.ceil(month / 3);
}

/** Od 1. dnia bieżącego kwartału do dziś (włącznie). */
export function currentQuarterPeriod(today: CalendarDate): SheetDateRange {
  const quarter = calendarQuarter(today.month);
  const startMonth = (quarter - 1) * 3 + 1;
  return {
    from: formatSheetDate({ year: today.year, month: startMonth, day: 1 }),
    to: formatSheetDate(today),
  };
}

/** Pełny kwartał kalendarzowy. `quarter` = 1..4. */
export function calendarQuarterPeriod(year: number, quarter: number): SheetDateRange {
  const startMonth = (quarter - 1) * 3 + 1;
  return calendarMonthSpan(year, startMonth, startMonth + 2);
}

/**
 * Pełny poprzedni kwartał względem `today`
 * (nie „ostatnie 90 dni”).
 */
export function previousQuarterPeriod(today: CalendarDate): SheetDateRange {
  const quarter = calendarQuarter(today.month);
  if (quarter === 1) {
    return calendarQuarterPeriod(today.year - 1, 4);
  }
  return calendarQuarterPeriod(today.year, quarter - 1);
}

/**
 * Exact od–do. ISO `yyyy-mm-dd` albo już `dd.mm.yyyy`.
 * Zły kalendarz albo from > to → null.
 */
export function exactPeriod(from: string, to: string): SheetDateRange | null {
  const dataOd = toSheetBound(from);
  const dataDo = toSheetBound(to);
  if (!dataOd || !dataDo) {
    return null;
  }
  if (compareSheetDate(dataOd, dataDo) > 0) {
    return null;
  }
  return { from: dataOd, to: dataDo };
}

/** Data odbioru ∈ [from, to] włącznie. */
export function inSheetDateRange(pickupDate: string, range: SheetDateRange): boolean {
  return (
    compareSheetDate(pickupDate, range.from) >= 0 && compareSheetDate(pickupDate, range.to) <= 0
  );
}

/** Tydzień przy okresie ≤ 45 dni (włącznie), inaczej miesiąc. */
export function timeBucketGranularity(range: SheetDateRange): TimeBucketGranularity {
  return inclusiveDayCount(range) <= TIME_SERIES_WEEK_MAX_DAYS ? "week" : "month";
}

/**
 * Backlog: nierozliczone i odbyte (bez filtra okresu).
 * Szacunek = `settle().total` (trasa raz).
 */
export function aggregateBacklog(
  rows: readonly StatsRow[],
  contractor?: string,
): BacklogStats {
  const open = rows.filter(
    (row) =>
      !row.settled &&
      row.happened &&
      rowMode(row) === "report" &&
      matchesContractor(row, contractor),
  );
  const statement = settle({
    rows: open.map(toRegisterRow),
    rates: [],
    screenByRow: {},
  });
  return { count: open.length, estimate: statement.total };
}

/** Rozliczone w okresie: odbyte, suma kol. P. */
export function aggregateSettled(rows: readonly StatsRow[], filters: StatsFilters): SettledStats {
  const matched = rows.filter(
    (row) =>
      row.settled &&
      row.happened &&
      matchesContractor(row, filters.contractor) &&
      inSheetDateRange(row.pickupDate, filters.range),
  );
  return {
    count: matched.length,
    receptionSum: matched.reduce((sum, row) => sum + (row.receptionCost ?? 0), 0),
  };
}

/**
 * Średnia Q: rozliczone, odbyte, worki > 0, Q niepuste.
 * Średnia w groszach z `divRoundHalfUp`.
 */
export function aggregateAvgQ(rows: readonly StatsRow[], filters: StatsFilters): AvgQStats {
  const pool = qPool(rows, filters);
  if (pool.length === 0) {
    return { average: null, sampleCount: 0 };
  }
  const sum = pool.reduce((acc, row) => acc + (row.costPerBag as Grosze), 0);
  return { average: divRoundHalfUp(sum, pool.length), sampleCount: pool.length };
}

/** Top N (domyślnie 5) najdroższe / najtańsze po Q. */
export function aggregateQRanks(
  rows: readonly StatsRow[],
  filters: StatsFilters,
  topN = 5,
): QRankStats {
  const entries = qPool(rows, filters).map(toRankEntry);
  const byQDesc = [...entries].sort((a, b) => b.costPerBag - a.costPerBag || a.address.localeCompare(b.address));
  const byQAsc = [...entries].sort((a, b) => a.costPerBag - b.costPerBag || a.address.localeCompare(b.address));
  return {
    expensive: byQDesc.slice(0, topN),
    cheap: byQAsc.slice(0, topN),
  };
}

/**
 * Luki: puste L/M na nierozliczonych odbytych + remis `resolveRate` na wierszu.
 * Zero w L/M nie jest luką.
 */
export function aggregateRateGaps(
  rows: readonly StatsRow[],
  rates: readonly SettlementRateRow[],
  contractor?: string,
): RateGapsStats {
  const open = rows.filter(
    (row) =>
      !row.settled &&
      row.happened &&
      rowMode(row) === "report" &&
      matchesContractor(row, contractor),
  );
  const entries: RateGapEntry[] = [];
  for (const row of open) {
    if (row.pickupRate === null) {
      entries.push(gapEntry(row, "emptyPickup", null));
    }
    if (row.bagRate === null) {
      entries.push(gapEntry(row, "emptyBag", null));
    }
    const resolved = resolveRate(rates, row.address, row.contractor, row.pickupDate);
    if (resolved.kind === "tie") {
      entries.push(gapEntry(row, "tie", resolved.tie));
    }
  }
  const emptySnapshotCount = entries.filter(
    (e) => e.kind === "emptyPickup" || e.kind === "emptyBag",
  ).length;
  const tieCount = entries.filter((e) => e.kind === "tie").length;
  return {
    entries,
    emptySnapshotCount,
    tieCount,
    total: emptySnapshotCount + tieCount,
  };
}

/** Remisy w Bazie: ≥2 wiersze tej samej pary i `validFrom`. */
export function findRateTiesInBase(rates: readonly SettlementRateRow[]): RateTie[] {
  const groups = new Map<string, { rate: SettlementRateRow; index: number }[]>();
  rates.forEach((rateRow, index) => {
    const key = `${rateRow.shop}\t${rateRow.contractor}\t${rateRow.validFrom}`;
    const group = groups.get(key);
    if (group) {
      group.push({ rate: rateRow, index });
    } else {
      groups.set(key, [{ rate: rateRow, index }]);
    }
  });
  const ties: RateTie[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const first = group[0].rate;
    const candidates: RateCandidate[] = group.map((entry) => ({
      index: entry.index,
      validFrom: entry.rate.validFrom,
      pickupAmount: entry.rate.pickupAmount,
      bagAmount: entry.rate.bagAmount,
    }));
    ties.push({
      shop: first.shop,
      contractor: first.contractor,
      validFrom: first.validFrom,
      candidates,
    });
  }
  return ties;
}

/** Liczba zrealizowanych odbiorów + unikalne adresy w okresie. */
export function aggregatePeriodActivity(
  rows: readonly StatsRow[],
  filters: StatsFilters,
): PeriodActivityStats {
  const matched = rows.filter(
    (row) =>
      row.happened &&
      matchesContractor(row, filters.contractor) &&
      inSheetDateRange(row.pickupDate, filters.range),
  );
  const addresses = new Set(matched.map((row) => row.address));
  return { pickupCount: matched.length, uniqueShopCount: addresses.size };
}

/**
 * Suma worków (I) z zrealizowanych odbiorów w buckettach.
 * Brak trybu = Na zgłoszenie.
 */
export function aggregateBagsOverTime(
  rows: readonly StatsRow[],
  filters: StatsFilters,
): TimeSeriesStats {
  return aggregateTimeSeries(rows, filters, {
    include: (row) => row.happened,
    value: (row) => row.bagCount ?? 0,
  });
}

/**
 * Suma kosztów rozliczonych (P) w buckettach.
 * Brak trybu = Na zgłoszenie.
 */
export function aggregateCostsOverTime(
  rows: readonly StatsRow[],
  filters: StatsFilters,
): TimeSeriesStats {
  return aggregateTimeSeries(rows, filters, {
    include: (row) => row.happened && row.settled,
    value: (row) => row.receptionCost ?? 0,
  });
}

/**
 * Ranking podwykonawców: śr. P i śr. Q.
 * Tylko rozliczone, zrealizowane, worki > 0.
 */
export function aggregateContractorRanks(
  rows: readonly StatsRow[],
  filters: StatsFilters,
  topN = 5,
): ContractorRankStats {
  const pool = qPool(rows, filters);
  const byContractor = new Map<
    string,
    { pSum: Grosze; qSum: Grosze; count: number; bags: number }
  >();
  for (const row of pool) {
    const prev = byContractor.get(row.contractor) ?? {
      pSum: 0,
      qSum: 0,
      count: 0,
      bags: 0,
    };
    byContractor.set(row.contractor, {
      pSum: prev.pSum + (row.receptionCost ?? 0),
      qSum: prev.qSum + (row.costPerBag as Grosze),
      count: prev.count + 1,
      bags: prev.bags + (row.bagCount ?? 0),
    });
  }
  const byShop: ContractorRankEntry[] = [];
  const byBag: ContractorRankEntry[] = [];
  for (const [contractor, agg] of byContractor) {
    byShop.push({
      contractor,
      average: divRoundHalfUp(agg.pSum, agg.count),
      pickupCount: agg.count,
      bagCount: agg.bags,
    });
    byBag.push({
      contractor,
      average: divRoundHalfUp(agg.qSum, agg.count),
      pickupCount: agg.count,
      bagCount: agg.bags,
    });
  }
  return {
    byShop: rankContractors(byShop, topN),
    byBag: rankContractors(byBag, topN),
  };
}

/**
 * Odbiory z I = 0 w okresie (także nierozliczone).
 * `null` ilości nie wchodzi (to nie zero).
 */
export function listZeroBagPickups(
  rows: readonly StatsRow[],
  filters: StatsFilters,
): ZeroBagPickup[] {
  return rows
    .filter(
      (row) =>
        row.happened &&
        row.bagCount === 0 &&
        matchesContractor(row, filters.contractor) &&
        inSheetDateRange(row.pickupDate, filters.range),
    )
    .map((row) => ({
      address: row.address,
      shopName: row.shopName,
      contractor: row.contractor,
      pickupDate: row.pickupDate,
      settled: row.settled,
      receptionCost: row.receptionCost,
    }))
    .sort(
      (a, b) =>
        compareSheetDate(a.pickupDate, b.pickupDate) || a.address.localeCompare(b.address),
    );
}

/**
 * Odbiory w okresie: Na zgłoszenie (rejestr) + Harmonogram (odebrane).
 * Sort: data, tryb, adres.
 */
export function listPeriodPickups(
  rows: readonly StatsRow[],
  filters: StatsFilters,
): PeriodPickup[] {
  return rows
    .filter(
      (row) =>
        row.happened &&
        matchesContractor(row, filters.contractor) &&
        inSheetDateRange(row.pickupDate, filters.range),
    )
    .map((row) => ({
      address: row.address,
      shopName: row.shopName,
      contractor: row.contractor,
      pickupDate: row.pickupDate,
      bagCount: row.bagCount,
      mode: rowMode(row),
      settled: row.settled,
    }))
    .sort((a, b) => {
      const byDate = compareSheetDate(a.pickupDate, b.pickupDate);
      if (byDate !== 0) {
        return byDate;
      }
      if (a.mode !== b.mode) {
        return a.mode === "report" ? -1 : 1;
      }
      return a.address.localeCompare(b.address, "pl");
    });
}

function aggregateTimeSeries(
  rows: readonly StatsRow[],
  filters: StatsFilters,
  rules: {
    include: (row: StatsRow) => boolean;
    value: (row: StatsRow) => number;
  },
): TimeSeriesStats {
  const granularity = timeBucketGranularity(filters.range);
  const frames = buildTimeBuckets(filters.range, granularity);
  const matched = rows.filter(
    (row) =>
      rules.include(row) &&
      matchesContractor(row, filters.contractor) &&
      inSheetDateRange(row.pickupDate, filters.range),
  );
  const asOfSheet = filters.asOf ? formatSheetDate(filters.asOf) : null;
  const buckets: TimeSeriesBucket[] = frames.map((frame) => {
    let report = 0;
    let schedule = 0;
    for (const row of matched) {
      if (!inSheetDateRange(row.pickupDate, frame)) {
        continue;
      }
      const amount = rules.value(row);
      if (rowMode(row) === "schedule") {
        schedule += amount;
      } else {
        report += amount;
      }
    }
    return {
      label: frame.label,
      from: frame.from,
      to: frame.to,
      report,
      schedule,
      total: report + schedule,
      incomplete: asOfSheet !== null && inSheetDateRange(asOfSheet, frame),
    };
  });
  return { granularity, buckets };
}

function buildTimeBuckets(
  range: SheetDateRange,
  granularity: TimeBucketGranularity,
): Array<SheetDateRange & { label: string }> {
  if (granularity === "month") {
    return buildMonthBuckets(range);
  }
  return buildWeekBuckets(range);
}

function buildWeekBuckets(range: SheetDateRange): Array<SheetDateRange & { label: string }> {
  const rangeFrom = parseSheetDate(range.from);
  const rangeTo = parseSheetDate(range.to);
  let cursor = mondayOnOrBefore(rangeFrom);
  const buckets: Array<SheetDateRange & { label: string }> = [];
  while (compareCalendar(cursor, rangeTo) <= 0) {
    const weekEnd = addDays(cursor, 6);
    const clipFrom = maxCalendar(cursor, rangeFrom);
    const clipTo = minCalendar(weekEnd, rangeTo);
    if (compareCalendar(clipFrom, clipTo) <= 0) {
      buckets.push({
        from: formatSheetDate(clipFrom),
        to: formatSheetDate(clipTo),
        label: formatWeekLabel(clipFrom, clipTo),
      });
    }
    cursor = addDays(cursor, 7);
  }
  return buckets;
}

function buildMonthBuckets(range: SheetDateRange): Array<SheetDateRange & { label: string }> {
  const rangeFrom = parseSheetDate(range.from);
  const rangeTo = parseSheetDate(range.to);
  let year = rangeFrom.year;
  let month = rangeFrom.month;
  const buckets: Array<SheetDateRange & { label: string }> = [];
  while (year < rangeTo.year || (year === rangeTo.year && month <= rangeTo.month)) {
    const monthStart: CalendarDate = { year, month, day: 1 };
    const monthEnd: CalendarDate = { year, month, day: daysInMonth(year, month) };
    const clipFrom = maxCalendar(monthStart, rangeFrom);
    const clipTo = minCalendar(monthEnd, rangeTo);
    if (compareCalendar(clipFrom, clipTo) <= 0) {
      buckets.push({
        from: formatSheetDate(clipFrom),
        to: formatSheetDate(clipTo),
        label: `${String(month).padStart(2, "0")}.${year}`,
      });
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return buckets;
}

function formatWeekLabel(from: CalendarDate, to: CalendarDate): string {
  if (from.month === to.month && from.year === to.year) {
    return `${from.day}–${to.day}.${String(from.month).padStart(2, "0")}`;
  }
  return `${from.day}.${String(from.month).padStart(2, "0")}–${to.day}.${String(to.month).padStart(2, "0")}`;
}

function rankContractors(
  entries: ContractorRankEntry[],
  topN: number,
): { expensive: ContractorRankEntry[]; cheap: ContractorRankEntry[] } {
  const desc = [...entries].sort(
    (a, b) => b.average - a.average || a.contractor.localeCompare(b.contractor),
  );
  const asc = [...entries].sort(
    (a, b) => a.average - b.average || a.contractor.localeCompare(b.contractor),
  );
  return { expensive: desc.slice(0, topN), cheap: asc.slice(0, topN) };
}

function rowMode(row: StatsRow): SettlementMode {
  return row.mode === "schedule" ? "schedule" : "report";
}

function inclusiveDayCount(range: SheetDateRange): number {
  const from = parseSheetDate(range.from);
  const to = parseSheetDate(range.to);
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_DAY) + 1;
}

function mondayOnOrBefore(date: CalendarDate): CalendarDate {
  const utc = new Date(toUtcMs(date));
  const dow = utc.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(date, -back);
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(toUtcMs(date) + days * MS_DAY);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function toUtcMs(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function compareCalendar(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
}

function maxCalendar(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareCalendar(a, b) >= 0 ? a : b;
}

function minCalendar(a: CalendarDate, b: CalendarDate): CalendarDate {
  return compareCalendar(a, b) <= 0 ? a : b;
}

function calendarMonthSpan(year: number, fromMonth: number, toMonth: number): SheetDateRange {
  return {
    from: formatSheetDate({ year, month: fromMonth, day: 1 }),
    to: formatSheetDate({ year, month: toMonth, day: daysInMonth(year, toMonth) }),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toSheetBound(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (hasSheetDateShape(trimmed)) {
    try {
      parseSheetDate(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }
  return isoToSheetDate(trimmed);
}

function matchesContractor(row: StatsRow, contractor?: string): boolean {
  if (contractor === undefined || contractor === "") {
    return true;
  }
  return row.contractor === contractor;
}

function toRegisterRow(row: StatsRow): RegisterRow {
  return {
    sheetRow: row.sheetRow,
    transportNumber: row.transportNumber,
    address: row.address,
    shopName: row.shopName,
    pickupDate: row.pickupDate,
    contractor: row.contractor,
    bagCount: row.bagCount,
    routeName: row.routeName,
    routeRate: row.routeRate,
    pickupRate: row.pickupRate,
    bagRate: row.bagRate,
  };
}

function qPool(rows: readonly StatsRow[], filters: StatsFilters): StatsRow[] {
  return rows.filter(
    (row) =>
      row.settled &&
      row.happened &&
      matchesContractor(row, filters.contractor) &&
      inSheetDateRange(row.pickupDate, filters.range) &&
      row.bagCount !== null &&
      row.bagCount > 0 &&
      row.costPerBag !== null,
  );
}

function toRankEntry(row: StatsRow): QRankEntry {
  return {
    address: row.address,
    shopName: row.shopName,
    pickupDate: row.pickupDate,
    contractor: row.contractor,
    bagCount: row.bagCount as number,
    costPerBag: row.costPerBag as Grosze,
  };
}

function gapEntry(row: StatsRow, kind: RateGapKind, tie: RateTie | null): RateGapEntry {
  return {
    address: row.address,
    shopName: row.shopName,
    contractor: row.contractor,
    pickupDate: row.pickupDate,
    kind,
    tie,
  };
}

export type StatsPeriodKind = "current" | "prev" | "quarter" | "prevQuarter" | "exact";

export interface MonthOption {
  year: number;
  month: number;
  /** `yyyy-mm` */
  value: string;
  label: string;
}

export interface QuarterOption {
  year: number;
  /** 1..4 */
  quarter: number;
  /** `yyyy-Qn` */
  value: string;
  label: string;
}

export interface StatsReport {
  activity: PeriodActivityStats;
  backlog: BacklogStats;
  settled: SettledStats;
  avgQ: AvgQStats;
  qRanks: QRankStats;
  rateGaps: RateGapsStats;
  bagsOverTime: TimeSeriesStats;
  costsOverTime: TimeSeriesStats;
  contractorRanks: ContractorRankStats;
  zeroBags: ZeroBagPickup[];
  periodPickups: PeriodPickup[];
}

export const STATS_PAGE_SIZE = 5;

/** Przy ≥ tylu bucketach wykres i tabela w kolumnie (długi okres). */
export const STATS_STACK_MIN_BUCKETS = 7;

const MONTH_PL = [
  "",
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

const QUARTER_ROMAN = ["", "I", "II", "III", "IV"] as const;

/** Pełny raport pod filtry (wszystkie bloki ekranu). */
export function buildStatsReport(
  rows: readonly StatsRow[],
  rates: readonly SettlementRateRow[],
  filters: StatsFilters,
): StatsReport {
  return {
    activity: aggregatePeriodActivity(rows, filters),
    backlog: aggregateBacklog(rows, filters.contractor),
    settled: aggregateSettled(rows, filters),
    avgQ: aggregateAvgQ(rows, filters),
    qRanks: aggregateQRanks(rows, filters),
    rateGaps: aggregateRateGaps(rows, rates, filters.contractor),
    bagsOverTime: aggregateBagsOverTime(rows, filters),
    costsOverTime: aggregateCostsOverTime(rows, filters),
    contractorRanks: aggregateContractorRanks(rows, filters),
    zeroBags: listZeroBagPickups(rows, filters),
    periodPickups: listPeriodPickups(rows, filters),
  };
}

/** Poprzednie pełne miesiące (bez bieżącego), od najnowszego. */
export function previousMonthOptions(today: CalendarDate, count = 12): MonthOption[] {
  const out: MonthOption[] = [];
  let year = today.year;
  let month = today.month - 1;
  for (let i = 0; i < count; i++) {
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    out.push({
      year,
      month,
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: `${MONTH_PL[month]} ${year}`,
    });
    month -= 1;
  }
  return out;
}

export function monthOptionLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return value;
  }
  return `${MONTH_PL[month]} ${match[1]}`;
}

/** Poprzednie pełne kwartały (bez bieżącego), od najnowszego. */
export function previousQuarterOptions(today: CalendarDate, count = 8): QuarterOption[] {
  const out: QuarterOption[] = [];
  let year = today.year;
  let quarter = calendarQuarter(today.month) - 1;
  for (let i = 0; i < count; i++) {
    if (quarter < 1) {
      quarter = 4;
      year -= 1;
    }
    out.push({
      year,
      quarter,
      value: `${year}-Q${quarter}`,
      label: `${QUARTER_ROMAN[quarter]} kwartał ${year}`,
    });
    quarter -= 1;
  }
  return out;
}

export function quarterOptionLabel(value: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) {
    return value;
  }
  const quarter = Number(match[2]);
  return `${QUARTER_ROMAN[quarter]} kwartał ${match[1]}`;
}

/**
 * Zakres dat z chipa + pól pomocniczych.
 * `month` = `yyyy-mm`; `quarter` = `yyyy-Qn`; `from`/`to` = ISO lub arkusz.
 */
export function resolveStatsPeriod(
  kind: StatsPeriodKind,
  today: CalendarDate,
  draft: { month: string; quarter: string; from: string; to: string },
): SheetDateRange | null {
  if (kind === "current") {
    return currentMonthPeriod(today);
  }
  if (kind === "quarter") {
    return currentQuarterPeriod(today);
  }
  if (kind === "prevQuarter") {
    const match = /^(\d{4})-Q([1-4])$/.exec(draft.quarter);
    if (!match) {
      return null;
    }
    return calendarQuarterPeriod(Number(match[1]), Number(match[2]));
  }
  if (kind === "prev") {
    const match = /^(\d{4})-(\d{2})$/.exec(draft.month);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      return null;
    }
    return calendarMonthPeriod(year, month);
  }
  return exactPeriod(draft.from, draft.to);
}

/** Podpis pod chipami (język zarządu). */
export function statsPeriodKindLabel(
  kind: StatsPeriodKind,
  monthValue = "",
  quarterValue = "",
): string {
  if (kind === "current") {
    return "bieżący miesiąc";
  }
  if (kind === "quarter") {
    return "bieżący kwartał";
  }
  if (kind === "prevQuarter") {
    return quarterOptionLabel(quarterValue) || "poprzedni kwartał";
  }
  if (kind === "prev") {
    return monthOptionLabel(monthValue) || "poprzedni miesiąc";
  }
  return "dokładny zakres";
}

export function rateGapLabel(kind: RateGapKind): string {
  if (kind === "emptyPickup") {
    return "Brak stawki za dojazd";
  }
  if (kind === "emptyBag") {
    return "Brak stawki za worek";
  }
  return "Konflikt: kilka stawek w bazie";
}

/** Stronicowanie 1-based; pusta lista → strona 1, pusty slice. */
export function pageSlice<T>(items: readonly T[], page: number, size = STATS_PAGE_SIZE): {
  page: number;
  pages: number;
  slice: T[];
  total: number;
} {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const safe = Math.min(Math.max(1, page), pages);
  const start = (safe - 1) * size;
  return { page: safe, pages, slice: items.slice(start, start + size), total };
}

export function chartShouldStack(series: TimeSeriesStats): boolean {
  return series.buckets.length >= STATS_STACK_MIN_BUCKETS;
}
