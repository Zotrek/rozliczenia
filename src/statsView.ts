import { escapeHtml } from "./html.js";
import { foldPl, modeLabel, type ContractorListItem } from "./range.js";
import { formatPln } from "./statement.js";
import {
  chartShouldStack,
  pageSlice,
  previousMonthOptions,
  previousQuarterOptions,
  rateGapLabel,
  statsPeriodKindLabel,
  STATS_PAGE_SIZE,
  type MonthOption,
  type PeriodPickup,
  type QuarterOption,
  type StatsPeriodKind,
  type StatsReport,
  type TimeSeriesStats,
} from "./stats.js";
import { compareSheetDate, type CalendarDate } from "./sheetDate.js";
import type { Grosze } from "./types.js";

const PICKUP_COLUMN_KEYS = ["date", "shop", "contractor", "mode", "bags", "settled", "invoiceNumber", "invoice"] as const;

export type PickupColumnKey = (typeof PICKUP_COLUMN_KEYS)[number];

export interface PickupColumnMenu {
  column: PickupColumnKey;
  /** Zaznaczone wartości zanim użytkownik naciśnie OK. */
  draft: readonly string[];
  query: string;
}

export interface PickupTableState {
  sortKey: PickupColumnKey | null;
  sortDir: "asc" | "desc";
  /** Brak klucza = kolumna bez filtra. Pusta lista = nic nie przechodzi. */
  filters: Partial<Record<PickupColumnKey, readonly string[]>>;
  menu: PickupColumnMenu | null;
}

const PICKUP_COLUMNS: readonly { key: PickupColumnKey; label: string; numeric: boolean }[] = [
  { key: "date", label: "Data", numeric: false },
  { key: "shop", label: "Sklep", numeric: false },
  { key: "contractor", label: "Podwykonawca", numeric: false },
  { key: "mode", label: "Tryb", numeric: false },
  { key: "bags", label: "Worki", numeric: true },
  { key: "settled", label: "Rozliczone", numeric: false },
  { key: "invoiceNumber", label: "Numer faktury", numeric: false },
  { key: "invoice", label: "Wartość faktury", numeric: true },
];

const FUNNEL_ICON =
  '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M1.5 2.5h13l-5 6.1V13l-3 1.1V8.6z"/></svg>';

export function emptyPickupTable(): PickupTableState {
  return { sortKey: null, sortDir: "asc", filters: {}, menu: null };
}

export function isPickupColumnKey(value: string): value is PickupColumnKey {
  return (PICKUP_COLUMN_KEYS as readonly string[]).includes(value);
}

/** Tekst komórki, ten sam w tabeli i na liście filtra. */
export function pickupCellText(row: PeriodPickup, key: PickupColumnKey): string {
  if (key === "date") {
    return row.pickupDate;
  }
  if (key === "shop") {
    const name = row.shopName.trim();
    if (name === "" || name === row.address) {
      return row.address;
    }
    return `${row.address} · ${name}`;
  }
  if (key === "contractor") {
    return row.contractor;
  }
  if (key === "mode") {
    return modeLabel(row.mode);
  }
  if (key === "bags") {
    return row.bagCount === null ? "—" : String(row.bagCount);
  }
  if (key === "settled") {
    return row.settled ? "Tak" : "Nie";
  }
  if (key === "invoiceNumber") {
    return invoiceNumberText(row.invoice);
  }
  return row.invoiceValue === null ? "—" : formatPln(row.invoiceValue);
}

export function pickupQueryHits(text: string, query: string): boolean {
  const folded = foldPl(query);
  if (folded === "") {
    return true;
  }
  return foldPl(text).includes(folded);
}

export function filterPeriodPickups(
  rows: readonly PeriodPickup[],
  filters: PickupTableState["filters"],
): PeriodPickup[] {
  const active = (Object.keys(filters) as PickupColumnKey[]).filter((key) => filters[key] != null);
  if (active.length === 0) {
    return [...rows];
  }
  const sets = active.map((key) => [key, new Set(filters[key])] as const);
  return rows.filter((row) => sets.every(([key, set]) => set.has(pickupCellText(row, key))));
}

/** Wartości kolumny po filtrach pozostałych kolumn, w kolejności sortowania rosnącego. */
export function pickupColumnChoices(
  rows: readonly PeriodPickup[],
  filters: PickupTableState["filters"],
  column: PickupColumnKey,
): string[] {
  const rest: PickupTableState["filters"] = { ...filters };
  delete rest[column];
  const first = new Map<string, PeriodPickup>();
  for (const row of filterPeriodPickups(rows, rest)) {
    const text = pickupCellText(row, column);
    if (!first.has(text)) {
      first.set(text, row);
    }
  }
  return [...first.entries()]
    .sort((a, b) => {
      const aBlank = isBlankNumber(a[1], column);
      const bBlank = isBlankNumber(b[1], column);
      if (aBlank !== bBlank) {
        return aBlank ? 1 : -1;
      }
      return comparePickups(a[1], b[1], column) || a[0].localeCompare(b[0], "pl");
    })
    .map(([text]) => text);
}

export function sortPeriodPickups(
  rows: readonly PeriodPickup[],
  sortKey: PickupColumnKey | null,
  sortDir: "asc" | "desc",
): PeriodPickup[] {
  if (sortKey === null) {
    return [...rows];
  }
  const key = sortKey;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aBlank = isBlankNumber(a.row, key);
      const bBlank = isBlankNumber(b.row, key);
      if (aBlank !== bBlank) {
        return aBlank ? 1 : -1;
      }
      const cmp = comparePickups(a.row, b.row, key);
      if (cmp === 0) {
        return a.index - b.index;
      }
      return sortDir === "asc" ? cmp : -cmp;
    })
    .map((item) => item.row);
}

export function visiblePeriodPickups(
  rows: readonly PeriodPickup[],
  state: PickupTableState,
): PeriodPickup[] {
  return sortPeriodPickups(filterPeriodPickups(rows, state.filters), state.sortKey, state.sortDir);
}

/** OK w menu kolumny. Zaznaczenie każdej wartości zdejmuje filtr. */
export function pickupFiltersAfterApply(
  filters: PickupTableState["filters"],
  column: PickupColumnKey,
  choices: readonly string[],
  draft: readonly string[],
): PickupTableState["filters"] {
  const selected = new Set(draft);
  const allOn = choices.length > 0 && choices.every((text) => selected.has(text));
  const next: PickupTableState["filters"] = { ...filters };
  if (choices.length === 0 || allOn) {
    delete next[column];
  } else {
    next[column] = [...draft];
  }
  return next;
}

/** „Zaznacz wszystko” przy wpisanym szukaniu rusza tylko widoczne wartości. */
export function pickupDraftAfterVisible(
  draft: readonly string[],
  visible: readonly string[],
  on: boolean,
): string[] {
  const next = new Set(draft);
  for (const text of visible) {
    if (on) {
      next.add(text);
    } else {
      next.delete(text);
    }
  }
  return [...next];
}

function isBlankNumber(row: PeriodPickup, key: PickupColumnKey): boolean {
  if (key === "bags") {
    return row.bagCount === null;
  }
  if (key === "invoice") {
    return row.invoiceValue === null;
  }
  if (key === "invoiceNumber") {
    return row.invoice.trim() === "";
  }
  return false;
}

function comparePickups(a: PeriodPickup, b: PeriodPickup, key: PickupColumnKey): number {
  if (key === "date") {
    return compareSheetDate(a.pickupDate, b.pickupDate);
  }
  if (key === "bags") {
    return (a.bagCount ?? 0) - (b.bagCount ?? 0);
  }
  if (key === "invoice") {
    return (a.invoiceValue ?? 0) - (b.invoiceValue ?? 0);
  }
  return pickupCellText(a, key).localeCompare(pickupCellText(b, key), "pl", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortPhrase(key: PickupColumnKey, dir: "asc" | "desc"): string {
  if (key === "date") {
    return dir === "asc" ? "Sortuj od najstarszych" : "Sortuj od najnowszych";
  }
  if (key === "bags" || key === "invoice") {
    return dir === "asc" ? "Sortuj od najmniejszych" : "Sortuj od największych";
  }
  return dir === "asc" ? "Sortuj od A do Z" : "Sortuj od Z do A";
}

function filterButtonLabel(label: string, filtered: boolean, sort: "asc" | "desc" | null): string {
  const bits = [`Sortuj i filtruj kolumnę ${label}`];
  if (filtered) {
    bits.push("filtr włączony");
  }
  if (sort === "asc") {
    bits.push("sortowanie rosnąco");
  }
  if (sort === "desc") {
    bits.push("sortowanie malejąco");
  }
  return bits.join(", ");
}

export const STATS_FOLD_LS_PREFIX = "rozliczenia.stats.fold.";

export interface StatsViewModel {
  period: StatsPeriodKind;
  month: string;
  quarter: string;
  from: string;
  to: string;
  contractor: string;
  contractors: readonly ContractorListItem[];
  months: readonly MonthOption[];
  quarters: readonly QuarterOption[];
  today: CalendarDate;
  /** Zakres zastosowany w ostatnim raporcie (arkusz). */
  appliedFrom: string;
  appliedTo: string;
  appliedKind: StatsPeriodKind;
  appliedMonth: string;
  appliedQuarter: string;
  appliedContractor: string;
  report: StatsReport | null;
  status: string;
  emptyBagsPage: number;
  gapsPage: number;
  pickupsPage: number;
  /** Sortowanie i filtr kolumn w tabeli odbiorów. */
  pickups: PickupTableState;
  /** Sekcje zwinięte (id → true). */
  sectionsCollapsed: Readonly<Record<string, boolean>>;
  /** Tabele pod wykresem zwinięte (id → true). */
  tablesCollapsed: Readonly<Record<string, boolean>>;
}

export function defaultStatsView(
  today: CalendarDate,
  over: Partial<StatsViewModel> = {},
): StatsViewModel {
  const months = previousMonthOptions(today);
  const month = months[0]?.value ?? `${today.year}-${String(today.month).padStart(2, "0")}`;
  const quarters = previousQuarterOptions(today);
  const quarter = quarters[0]?.value ?? `${today.year}-Q1`;
  return {
    period: "current",
    month,
    quarter,
    from: "",
    to: "",
    contractor: "",
    contractors: [],
    months,
    quarters,
    today,
    appliedFrom: "",
    appliedTo: "",
    appliedKind: "current",
    appliedMonth: month,
    appliedQuarter: quarter,
    appliedContractor: "",
    report: null,
    status: "",
    emptyBagsPage: 1,
    gapsPage: 1,
    pickupsPage: 1,
    pickups: emptyPickupTable(),
    sectionsCollapsed: {},
    tablesCollapsed: {},
    ...over,
  };
}

export function readStatsFold(storage: Storage | null, key: string): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(STATS_FOLD_LS_PREFIX + key);
  } catch {
    return null;
  }
}

export function writeStatsFold(storage: Storage | null, key: string, value: string): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STATS_FOLD_LS_PREFIX + key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Stan sekcji z localStorage (closed = zwinięta). */
export function loadSectionsCollapsed(
  storage: Storage | null,
  ids: readonly string[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) {
    out[id] = readStatsFold(storage, `section.${id}`) === "closed";
  }
  return out;
}

/**
 * Tabele pod długim wykresem: brak zapisu → zwinięta;
 * przy krótkim okresie ignorujemy collaps (zawsze widoczna).
 */
export function loadTablesCollapsed(
  storage: Storage | null,
  ids: readonly string[],
  stacked: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) {
    if (!stacked[id]) {
      out[id] = false;
      continue;
    }
    const saved = readStatsFold(storage, `table.${id}`);
    out[id] = saved == null ? true : saved === "closed";
  }
  return out;
}

export function renderStatsScreen(model: StatsViewModel): string {
  return (
    '<div class="stats" data-screen="stats">' +
    statsFilters(model) +
    statsBody(model) +
    "</div>"
  );
}

function statsFilters(model: StatsViewModel): string {
  const chips: { id: StatsPeriodKind; label: string }[] = [
    { id: "current", label: "Bieżący miesiąc" },
    { id: "prev", label: "Poprzednie miesiące" },
    { id: "quarter", label: "Bieżący kwartał" },
    { id: "prevQuarter", label: "Poprzednie kwartały" },
    { id: "exact", label: "Dokładny zakres" },
  ];
  const chipHtml = chips
    .map(
      (chip) =>
        `<button type="button" class="chip${model.period === chip.id ? " is-on" : ""}" ` +
        `data-action="stats-period" data-period="${chip.id}">${chip.label}</button>`,
    )
    .join("");
  const monthOpts = model.months
    .map(
      (m) =>
        `<option value="${escapeHtml(m.value)}"${m.value === model.month ? " selected" : ""}>` +
        `${escapeHtml(m.label)}</option>`,
    )
    .join("");
  const quarterOpts = model.quarters
    .map(
      (q) =>
        `<option value="${escapeHtml(q.value)}"${q.value === model.quarter ? " selected" : ""}>` +
        `${escapeHtml(q.label)}</option>`,
    )
    .join("");
  const whoOpts =
    '<option value="">Wszyscy</option>' +
    model.contractors
      .map((c) => {
        const name = c.nazwa.trim();
        if (name === "") {
          return "";
        }
        return (
          `<option value="${escapeHtml(name)}"${name === model.contractor ? " selected" : ""}>` +
          `${escapeHtml(name)}</option>`
        );
      })
      .join("");
  return (
    '<div class="filters">' +
    '<div class="field" style="flex: 1 1 100%;"><span>Okres</span>' +
    `<div class="period-chips" role="group" aria-label="Okres">${chipHtml}</div></div>` +
    `<div class="field month-pick${model.period === "prev" ? " is-on" : ""}">` +
    '<label for="stats-month">Miesiąc</label>' +
    `<select id="stats-month" data-stats="month">${monthOpts}</select></div>` +
    `<div class="field quarter-pick${model.period === "prevQuarter" ? " is-on" : ""}">` +
    '<label for="stats-quarter">Kwartał</label>' +
    `<select id="stats-quarter" data-stats="quarter">${quarterOpts}</select></div>` +
    `<div class="exact-range${model.period === "exact" ? " is-on" : ""}">` +
    '<div class="field"><label for="stats-from">Od</label>' +
    `<input id="stats-from" type="date" data-stats="from" value="${escapeHtml(model.from)}"></div>` +
    '<div class="field"><label for="stats-to">Do</label>' +
    `<input id="stats-to" type="date" data-stats="to" value="${escapeHtml(model.to)}"></div></div>` +
    '<div class="field"><label for="stats-who">Podwykonawca</label>' +
    `<select id="stats-who" data-stats="contractor">${whoOpts}</select></div>` +
    '<button type="button" class="btn-teal" data-action="stats-show">Pokaż raport</button>' +
    "</div>"
  );
}

function statsBody(model: StatsViewModel): string {
  const status = model.status ? `<p class="err">${escapeHtml(model.status)}</p>` : "";
  if (!model.report) {
    return (
      `<div class="body">${status}` +
      '<p class="period-label">Wybierz okres i naciśnij <strong>Pokaż raport</strong>.</p></div>'
    );
  }
  const who =
    model.appliedContractor === "" ? "Wszyscy" : model.appliedContractor;
  const kindLabel = statsPeriodKindLabel(
    model.appliedKind,
    model.appliedMonth,
    model.appliedQuarter,
  );
  const periodLabel =
    `Okres: <strong>${escapeHtml(model.appliedFrom)} – ${escapeHtml(model.appliedTo)}</strong>` +
    ` (${escapeHtml(kindLabel)}) · podwykonawca: <strong>${escapeHtml(who)}</strong>`;
  return (
    `<div class="body">${status}` +
    `<p class="period-label">${periodLabel}</p>` +
    kpiGrid(model.report) +
    section(
      "pickups",
      model,
      "Odbiory w okresie",
      "Każdy transport osobno · przy rozliczonym podgląd i edycja faktury · po 5 na stronę",
      periodPickupsBlock(model),
      true,
    ) +
    section(
      "bags",
      model,
      "Ile worków zabrano w czasie",
      bagsTimeSub(model.report.bagsOverTime),
      timeSeriesBlock("bags", model, model.report.bagsOverTime, false),
    ) +
    section(
      "costs",
      model,
      "Ile zapłacono w czasie",
      costsTimeSub(model.report.costsOverTime),
      timeSeriesBlock("costs", model, model.report.costsOverTime, true),
    ) +
    section(
      "q",
      model,
      "Koszt w przeliczeniu na worek",
      "Tylko rozliczone odbiory, w których zabrano worki · 5 najdroższych i 5 najtańszych sklepów",
      qRanksBlock(model.report),
    ) +
    section(
      "contractors",
      model,
      "Podwykonawcy — kto jest droższy, kto tańszy",
      "Średnie z rozliczonych odbiorów z workami · 5 najwyższych i 5 najniższych · najlepiej przy wyborze „Wszyscy”",
      contractorsBlock(model.report),
    ) +
    section(
      "empty-bags",
      model,
      "Odbiory bez worków",
      "Zrealizowane w okresie, ale bez zabranych worków · także jeszcze nierozliczone · po 5 na stronę",
      zeroBagsBlock(model),
      true,
    ) +
    section(
      "gaps",
      model,
      "Problemy ze stawkami",
      "Odbiory jeszcze nierozliczone, przy których brakuje stawki albo w bazie jest więcej niż jedna · po 5 na stronę",
      gapsBlock(model),
      true,
    ) +
    "</div>"
  );
}

function bagsTimeSub(series: TimeSeriesStats): string {
  const unit = series.granularity === "week" ? "tygodniami" : "miesiącami";
  return `Suma worków z zrealizowanych odbiorów · ${unit} · według sposobu zlecenia`;
}

function costsTimeSub(series: TimeSeriesStats): string {
  const unit = series.granularity === "week" ? "tygodniami" : "miesiącami";
  return `Suma kosztów już rozliczonych · ${unit} · według sposobu zlecenia`;
}

function section(
  id: string,
  model: StatsViewModel,
  title: string,
  sub: string,
  body: string,
  flush = false,
): string {
  const collapsed = model.sectionsCollapsed[id] === true;
  const menuOpen = id === "pickups" && model.pickups.menu !== null && !collapsed;
  const chev = collapsed ? "▸" : "▾";
  const aria = collapsed ? "Rozwiń sekcję" : "Zwiń sekcję";
  return (
    `<section class="section${collapsed ? " is-collapsed" : ""}${menuOpen ? " is-menu" : ""}" data-fold="${id}">` +
    `<div class="section-h" data-action="stats-fold" data-fold="${id}">` +
    `<div class="head-text"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(sub)}</p></div>` +
    `<button type="button" class="fold-chev" aria-label="${aria}">${chev}</button></div>` +
    `<div class="section-b"${flush ? ' style="padding: 0;"' : ""}>${body}</div></section>`
  );
}

function kpiGrid(report: StatsReport): string {
  const gapsSub =
    `${report.rateGaps.emptySnapshotCount} bez stawki · ${report.rateGaps.tieCount} ` +
    `${report.rateGaps.tieCount === 1 ? "konflikt stawek" : "konflikty stawek"}`;
  const avg =
    report.avgQ.average === null ? "—" : formatPln(report.avgQ.average);
  const avgSub =
    report.avgQ.sampleCount === 0
      ? "brak odbiorów z workami"
      : `ze ${report.avgQ.sampleCount} odbiorów, w których zabrano worki`;
  return (
    '<div class="kpi-grid">' +
    kpi("Liczba odbiorów", String(report.activity.pickupCount), "zrealizowane w okresie · każdy sklep osobno") +
    kpi("Obsłużone sklepy", String(report.activity.uniqueShopCount), "różne sklepy w okresie") +
    kpi("Problemy ze stawkami", String(report.rateGaps.total), gapsSub, "warn") +
    kpi(
      "Rozliczone w okresie",
      String(report.settled.count),
      `łącznie ${formatPln(report.settled.receptionSum)}`,
      "ok",
    ) +
    kpi(
      "Do rozliczenia",
      String(report.backlog.count),
      `szacunkowo ${formatPln(report.backlog.estimate)}`,
      "warn",
    ) +
    kpi("Średni koszt za worek", avg, avgSub) +
    "</div>"
  );
}

function kpi(title: string, value: string, sub: string, tone = ""): string {
  const cls = tone ? `kpi ${tone}` : "kpi";
  return (
    `<div class="${cls}">` +
    `<span>${escapeHtml(title)}</span>` +
    `<b>${escapeHtml(value)}</b>` +
    `<em>${escapeHtml(sub)}</em></div>`
  );
}

function timeSeriesBlock(
  id: "bags" | "costs",
  model: StatsViewModel,
  series: TimeSeriesStats,
  money: boolean,
): string {
  const stacked = chartShouldStack(series);
  const collapsed = stacked && (model.tablesCollapsed[id] ?? true);
  const col0 = series.granularity === "week" ? "Tydzień" : "Miesiąc";
  const foldLabel = money ? "Tabela z kwotami" : "Tabela z liczbami";
  const note =
    id === "bags"
      ? "Na zgłoszenie = rejestr (Arkusz1). Harmonogram = worki z zakładki „odebrane z harmonogramu” (1 wiersz = 1 worek)."
      : "Koszty rozliczone pochodzą z rejestru (Na zgłoszenie). Harmonogram w tej serii pojawia się dopiero po rozliczeniu w rejestrze.";
  const max = Math.max(1, ...series.buckets.map((b) => b.total));
  const hasIncomplete = series.buckets.some((b) => b.incomplete);
  const chart =
    `<div class="bags-time-chart${stacked ? " is-dense" : ""}" aria-hidden="true">` +
    series.buckets
      .map((b) => {
        const naH = Math.round((b.report / max) * 100);
        const hH = Math.round((b.schedule / max) * 100);
        const colCls = b.incomplete ? "bags-time-col is-incomplete" : "bags-time-col";
        const label = b.incomplete ? `${b.label} · trwa` : b.label;
        return (
          `<div class="${colCls}"${b.incomplete ? ' title="Okres jeszcze trwa — liczby mogą wzrosnąć"' : ""}>` +
          '<div class="bags-time-stack">' +
          `<i class="s-h" style="height:${hH}%"></i>` +
          `<i class="s-na" style="height:${naH}%"></i></div>` +
          `<span class="wk">${escapeHtml(label)}</span></div>`
        );
      })
      .join("") +
    "</div>";
  const rows = series.buckets
    .map((b) => {
      const fmt = (n: number) => (money ? formatPln(n as Grosze) : String(n));
      const range = b.incomplete
        ? `${b.from} – ${b.to} (trwa)`
        : `${b.from} – ${b.to}`;
      const rowCls = b.incomplete ? ' class="is-incomplete"' : "";
      return (
        `<tr${rowCls}><td>${escapeHtml(range)}</td>` +
        `<td class="num">${escapeHtml(fmt(b.report))}</td>` +
        `<td class="num">${escapeHtml(fmt(b.schedule))}</td>` +
        `<td class="num"><strong>${escapeHtml(fmt(b.total))}</strong></td></tr>`
      );
    })
    .join("");
  const incompleteLegend = hasIncomplete
    ? '<li><i class="c-open"></i> Okres trwa — liczby mogą wzrosnąć</li>'
    : "";
  return (
    '<ul class="bags-time-legend">' +
    '<li><i class="c-na"></i> Na zgłoszenie</li>' +
    '<li><i class="c-h"></i> Harmonogram</li>' +
    incompleteLegend +
    "</ul>" +
    `<div class="chart-split${stacked ? " is-stack" : ""}">` +
    chart +
    "<div>" +
    `<div class="table-fold-bar"><span class="muted">${foldLabel}</span>` +
    `<button type="button" data-action="stats-table-fold" data-table-fold="${id}">` +
    `${collapsed ? "Pokaż tabelę" : "Ukryj tabelę"}</button></div>` +
    `<div class="table-pane${collapsed ? " is-collapsed" : ""}" data-table="${id}">` +
    "<table><thead><tr>" +
    `<th>${col0}</th><th class="num">Na zgłoszenie</th><th class="num">Harmonogram</th><th class="num">Razem</th>` +
    `</tr></thead><tbody>${rows || emptyRow(4)}</tbody></table></div></div></div>` +
    `<p class="note">${escapeHtml(note)}</p>`
  );
}

function qRanksBlock(report: StatsReport): string {
  const avg =
    report.avgQ.average === null ? "—" : formatPln(report.avgQ.average);
  const avgSub =
    report.avgQ.sampleCount === 0 ? "brak odbiorów" : `${report.avgQ.sampleCount} odbiorów`;
  return (
    '<div class="bags-grid">' +
    `<div class="avg-box"><span>Średni koszt za worek</span><b>${escapeHtml(avg)}</b>` +
    `<em>${escapeHtml(avgSub)}</em></div>` +
    '<div class="rank hi"><h3>Najdroższe sklepy</h3>' +
    qTable(report.qRanks.expensive, "hi") +
    '</div><div class="rank lo"><h3>Najtańsze sklepy</h3>' +
    qTable(report.qRanks.cheap, "lo") +
    "</div></div>"
  );
}

function qTable(
  entries: StatsReport["qRanks"]["expensive"],
  tone: "hi" | "lo",
): string {
  const body = entries
    .map(
      (e) =>
        `<tr><td class="shop">${escapeHtml(e.address)}` +
        `<span class="sub">${escapeHtml(e.shopName)} · ${escapeHtml(e.pickupDate)}</span></td>` +
        `<td class="num">${e.bagCount}</td>` +
        `<td class="num money ${tone}">${escapeHtml(formatPln(e.costPerBag))}</td></tr>`,
    )
    .join("");
  return (
    "<table><thead><tr><th>Sklep</th><th class=\"num\">Worki</th><th class=\"num\">Koszt za worek</th></tr></thead>" +
    `<tbody>${body || emptyRow(3)}</tbody></table>`
  );
}

function contractorsBlock(report: StatsReport): string {
  return (
    rankPair(
      "W przeliczeniu na sklep",
      "Ile średnio kosztuje jeden odbiór u danego podwykonawcy (tylko gdy zabrano worki)",
      report.contractorRanks.byShop,
      "Średni koszt odbioru",
    ) +
    rankPair(
      "W przeliczeniu na worek",
      "Ile średnio kosztuje jeden worek u danego podwykonawcy",
      report.contractorRanks.byBag,
      "Średni koszt za worek",
    ) +
    '<p class="note">Odbiory, w których <strong>nie zabrano żadnego worka</strong>, nie wchodzą do tych średnich ani do rankingu sklepów powyżej. ' +
    "Gdy wybrany jest jeden podwykonawca, w tabeli widać tylko jego wynik.</p>"
  );
}

function rankPair(
  title: string,
  sub: string,
  ranks: StatsReport["contractorRanks"]["byShop"],
  amountHeader: string,
): string {
  return (
    '<div class="rank-block">' +
    `<p class="metric">${escapeHtml(title)}<span>${escapeHtml(sub)}</span></p>` +
    '<div class="rank-pair">' +
    '<div class="rank hi"><h3>Najdrożsi</h3>' +
    contractorTable(ranks.expensive, amountHeader, "hi") +
    '</div><div class="rank lo"><h3>Najtańsi</h3>' +
    contractorTable(ranks.cheap, amountHeader, "lo") +
    "</div></div></div>"
  );
}

function contractorTable(
  entries: StatsReport["contractorRanks"]["byShop"]["expensive"],
  amountHeader: string,
  tone: "hi" | "lo",
): string {
  const body = entries
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.contractor)}</td>` +
        `<td class="num money ${tone}">${escapeHtml(formatPln(e.average))}</td>` +
        `<td class="num">${e.bagCount}</td>` +
        `<td class="num">${e.pickupCount}</td></tr>`,
    )
    .join("");
  return (
    "<table><thead><tr><th>Podwykonawca</th>" +
    `<th class="num">${escapeHtml(amountHeader)}</th>` +
    '<th class="num">Worki</th><th class="num">Odbiory</th></tr></thead>' +
    `<tbody>${body || emptyRow(4)}</tbody></table>`
  );
}

function periodPickupsBlock(model: StatsViewModel): string {
  const report = model.report;
  if (!report) {
    return "";
  }
  const shown = visiblePeriodPickups(report.periodPickups, model.pickups);
  const paged = pageSlice(shown, model.pickupsPage);
  const body = paged.slice
    .map((row) => {
      const bags = row.bagCount === null ? "—" : String(row.bagCount);
      const value = row.invoiceValue == null ? "—" : formatPln(row.invoiceValue);
      return (
        `<tr><td>${escapeHtml(row.pickupDate)}</td>` +
        `<td class="shop">${escapeHtml(row.address)}` +
        `<span class="sub">${escapeHtml(row.shopName)}</span></td>` +
        `<td>${escapeHtml(row.contractor)}</td>` +
        `<td>${escapeHtml(modeLabel(row.mode))}</td>` +
        `<td class="num">${escapeHtml(bags)}</td>` +
        `<td>${row.settled ? "Tak" : "Nie"}</td>` +
        `${invoiceNumberCell(row)}` +
        `<td class="num">${escapeHtml(value)}</td></tr>`
      );
    })
    .join("");
  const empty =
    report.periodPickups.length === 0
      ? "Brak danych w tym okresie."
      : "Brak pozycji dla tego filtra.";
  return (
    pickupBar(model.pickups) +
    "<table><thead><tr>" +
    pickupHead(model) +
    `</tr></thead><tbody>${body || emptyRow(PICKUP_COLUMNS.length, empty)}</tbody></table>` +
    pager("pickups", paged) +
    '<p class="note" style="margin: 10px 12px 12px;">' +
    "Wartość faktury to suma kosztów odbioru z arkusza dla tego numeru, u tego podwykonawcy i w tym okresie. " +
    "Podgląd pokazuje tylko tę fakturę i nic nie zapisuje. " +
    "Edycja otwiera zestawienie nierozliczonych, wpisuje ten numer i na górze pokazuje pozycje tej faktury. " +
    "W Harmonogramie link jest też przy nierozliczonym wierszu. " +
    "Harmonogram: liczba worków = liczba wierszy w „odebrane z harmonogramu” dla sklepu i dnia. " +
    `Lista pokazuje po ${STATS_PAGE_SIZE} pozycji na stronę.</p>`
  );
}

function invoiceNumberText(invoice: string): string {
  const number = invoice.trim();
  return number === "" ? "—" : number;
}

function invoiceNumberCell(row: StatsReport["periodPickups"][number]): string {
  const label = escapeHtml(invoiceNumberText(row.invoice));
  const links = invoiceLinks(row);
  if (links === "") {
    return `<td>${label}</td>`;
  }
  return `<td><span class="invoice-no">${label}</span>${links}</td>`;
}

function invoiceLinks(row: StatsReport["periodPickups"][number]): string {
  // Harmonogram w tej tabeli to worki z „odebrane”, bez numeru faktury.
  // Link i tak otwiera rejestr harmonogramu dla tej firmy i okresu.
  if (!row.settled && row.mode !== "schedule") {
    return "";
  }
  const attrs =
    ` data-contractor="${escapeHtml(row.contractor)}"` +
    ` data-mode="${row.mode}"` +
    ` data-invoice="${escapeHtml(row.invoice)}"` +
    (row.settled && row.invoiceKnown ? ' data-invoice-known="1"' : "");
  return (
    '<div class="row-links">' +
    `<button type="button" data-action="invoice-preview"${attrs}>Podgląd</button>` +
    `<button type="button" data-action="invoice-edit"${attrs}>Edycja</button>` +
    "</div>"
  );
}

function zeroBagsBlock(model: StatsViewModel): string {
  const report = model.report;
  if (!report) {
    return "";
  }
  const paged = pageSlice(report.zeroBags, model.emptyBagsPage);
  const body = paged.slice
    .map((row) => {
      const cost =
        row.receptionCost === null ? "—" : formatPln(row.receptionCost);
      return (
        `<tr><td class="shop">${escapeHtml(row.address)}` +
        `<span class="sub">${escapeHtml(row.shopName)}</span></td>` +
        `<td>${escapeHtml(row.contractor)}</td>` +
        `<td>${escapeHtml(row.pickupDate)}</td>` +
        `<td>${row.settled ? "Tak" : "Nie"}</td>` +
        `<td class="num">${escapeHtml(cost)}</td></tr>`
      );
    })
    .join("");
  return (
    "<table><thead><tr>" +
    "<th>Sklep</th><th>Podwykonawca</th><th>Data odbioru</th><th>Czy rozliczone</th><th class=\"num\">Koszt odbioru</th>" +
    `</tr></thead><tbody>${body || emptyRow(5)}</tbody></table>` +
    pager("empty-bags", paged) +
    '<p class="note" style="margin: 10px 12px 12px;">' +
    "Te odbiory nie wchodzą do rankingów kosztów za worek ani do porównania podwykonawców. " +
    `Lista pokazuje po ${STATS_PAGE_SIZE} pozycji na stronę.</p>`
  );
}

function gapsBlock(model: StatsViewModel): string {
  const report = model.report;
  if (!report) {
    return "";
  }
  const paged = pageSlice(report.rateGaps.entries, model.gapsPage);
  const body = paged.slice
    .map((row) => {
      const tag = row.kind === "tie" ? "tag-tie" : "tag-gap";
      return (
        `<tr><td class="shop">${escapeHtml(row.address)}` +
        `<span class="sub">${escapeHtml(row.shopName)}</span></td>` +
        `<td>${escapeHtml(row.contractor)}</td>` +
        `<td>${escapeHtml(row.pickupDate)}</td>` +
        `<td><span class="tag ${tag}">${escapeHtml(rateGapLabel(row.kind))}</span></td></tr>`
      );
    })
    .join("");
  return (
    "<table><thead><tr>" +
    "<th>Sklep</th><th>Podwykonawca</th><th>Data odbioru</th><th>Na czym polega problem</th>" +
    `</tr></thead><tbody>${body || emptyRow(4)}</tbody></table>` +
    pager("gaps", paged)
  );
}

function pager(
  id: string,
  paged: { page: number; pages: number; total: number },
): string {
  if (paged.total <= STATS_PAGE_SIZE) {
    return `<div class="pager" data-pager="${id}" hidden></div>`;
  }
  const from = (paged.page - 1) * STATS_PAGE_SIZE + 1;
  const to = Math.min(paged.page * STATS_PAGE_SIZE, paged.total);
  const meta = `Pozycje ${from}–${to} z ${paged.total} · po ${STATS_PAGE_SIZE} na stronę`;
  return (
    `<div class="pager" data-pager="${id}">` +
    `<span class="meta">${escapeHtml(meta)}</span>` +
    '<div class="nav">' +
    `<button type="button" data-action="stats-page" data-pager="${id}" data-dir="prev"` +
    `${paged.page <= 1 ? " disabled" : ""}>← Poprzednia</button>` +
    `<span class="page-label">${paged.page} / ${paged.pages}</span>` +
    `<button type="button" data-action="stats-page" data-pager="${id}" data-dir="next"` +
    `${paged.page >= paged.pages ? " disabled" : ""}>Następna →</button>` +
    "</div></div>"
  );
}

function pickupHead(model: StatsViewModel): string {
  const state = model.pickups;
  return PICKUP_COLUMNS.map((col) => {
    const open = state.menu?.column === col.key && model.sectionsCollapsed.pickups !== true;
    const filtered = state.filters[col.key] != null;
    const sort = state.sortKey === col.key ? state.sortDir : null;
    const mark = sort === "asc" ? "▲" : sort === "desc" ? "▼" : FUNNEL_ICON;
    return (
      `<th class="${col.numeric ? "num " : ""}xl-th${open ? " is-open" : ""}">` +
      '<div class="xl-head">' +
      `<span>${escapeHtml(col.label)}</span>` +
      `<button type="button" class="xl-btn${filtered ? " is-on" : ""}" data-action="pickup-menu" data-col="${col.key}"` +
      ` aria-expanded="${open ? "true" : "false"}" aria-label="${escapeHtml(filterButtonLabel(col.label, filtered, sort))}">${mark}</button>` +
      "</div>" +
      (open ? pickupMenu(model, col.key) : "") +
      "</th>"
    );
  }).join("");
}

function pickupMenu(model: StatsViewModel, column: PickupColumnKey): string {
  const report = model.report;
  const menu = model.pickups.menu;
  if (!report || !menu || menu.column !== column) {
    return "";
  }
  const choices = pickupColumnChoices(report.periodPickups, model.pickups.filters, column);
  const visible = choices.filter((text) => pickupQueryHits(text, menu.query));
  const picked = new Set(menu.draft);
  const visibleOn = visible.filter((text) => picked.has(text)).length;
  const allChecked = visible.length > 0 && visibleOn === visible.length;
  const mixed = visibleOn > 0 && visibleOn < visible.length;
  const label = PICKUP_COLUMNS.find((item) => item.key === column)?.label ?? column;
  const hasFilter = model.pickups.filters[column] != null;
  const options =
    visible.length === 0
      ? '<p class="xl-empty">Brak pasujących wartości</p>'
      : visible
          .map(
            (text) =>
              `<label class="xl-opt"><input type="checkbox" data-pickup-value="${escapeHtml(text)}"${picked.has(text) ? " checked" : ""}>` +
              `<span>${escapeHtml(text)}</span></label>`,
          )
          .join("");
  const sortBtn = (dir: "asc" | "desc"): string => {
    const on = model.pickups.sortKey === column && model.pickups.sortDir === dir;
    return (
      `<button type="button" class="xl-sort${on ? " is-on" : ""}" data-action="pickup-sort" data-col="${column}" data-dir="${dir}" aria-pressed="${on ? "true" : "false"}">` +
      `${escapeHtml(sortPhrase(column, dir))}</button>`
    );
  };
  return (
    `<div class="xl-menu" data-xl-menu role="dialog" aria-label="${escapeHtml(`Sortuj i filtruj: ${label}`)}">` +
    sortBtn("asc") +
    sortBtn("desc") +
    (hasFilter
      ? `<button type="button" class="xl-clear" data-action="pickup-clear" data-col="${column}">${escapeHtml(`Wyczyść filtr z „${label}”`)}</button>`
      : "") +
    `<input class="xl-search" type="text" data-keep="pickup-query" placeholder="Szukaj" value="${escapeHtml(menu.query)}" autocomplete="off">` +
    `<label class="xl-opt xl-all"><input type="checkbox" data-pickup-all="1"${visible.length === 0 ? " disabled" : ""}${allChecked ? " checked" : ""}${mixed ? ' data-mixed="1"' : ""}>` +
    "<span>(Zaznacz wszystko)</span></label>" +
    `<div class="xl-values">${options}</div>` +
    '<div class="xl-actions">' +
    '<button type="button" class="btn-ghost" data-action="pickup-cancel">Anuluj</button>' +
    '<button type="button" class="btn-teal" data-action="pickup-ok">OK</button>' +
    "</div></div>"
  );
}

function pickupBar(state: PickupTableState): string {
  const filtered = PICKUP_COLUMNS.filter((col) => state.filters[col.key] != null).map((col) => col.label);
  if (state.sortKey === null && filtered.length === 0) {
    return "";
  }
  const bits: string[] = [];
  if (state.sortKey) {
    const label = PICKUP_COLUMNS.find((item) => item.key === state.sortKey)?.label ?? state.sortKey;
    const phrase = sortPhrase(state.sortKey, state.sortDir).replace(/^Sortuj /, "");
    bits.push(`Sortowanie: ${label}, ${phrase}`);
  }
  if (filtered.length > 0) {
    bits.push(`Filtr: ${filtered.join(", ")}`);
  }
  return (
    '<div class="xl-bar">' +
    `<span>${escapeHtml(bits.join(" · "))}</span>` +
    '<button type="button" data-action="pickup-clear-all">Wyczyść</button></div>'
  );
}

function emptyRow(cols: number, message = "Brak danych w tym okresie."): string {
  return `<tr><td colspan="${cols}" class="note" style="border:none;background:transparent">${escapeHtml(message)}</td></tr>`;
}
