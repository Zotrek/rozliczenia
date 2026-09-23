import { escapeHtml } from "./html.js";
import type { ContractorListItem } from "./range.js";
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
  type QuarterOption,
  type StatsPeriodKind,
  type StatsReport,
  type TimeSeriesStats,
} from "./stats.js";
import type { CalendarDate } from "./sheetDate.js";
import type { Grosze } from "./types.js";

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
    statsTop() +
    statsFilters(model) +
    statsBody(model) +
    "</div>"
  );
}

function statsTop(): string {
  return (
    '<div class="top">' +
    '<div class="brand"><img src="logo.png" alt="" width="36" height="36">' +
    "<div><strong>Rozliczenia</strong><em>Statystyki</em></div></div>" +
    '<button type="button" class="btn-ghost" data-action="stats-back">← Powrót</button>' +
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
  const chev = collapsed ? "▸" : "▾";
  const aria = collapsed ? "Rozwiń sekcję" : "Zwiń sekcję";
  return (
    `<section class="section${collapsed ? " is-collapsed" : ""}" data-fold="${id}">` +
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
      ? "Na razie wszystkie worki widać jako „Na zgłoszenie”. Podział na harmonogram pojawi się, gdy w danych będzie rozróżnienie sposobu zlecenia."
      : "Jak wyżej: do czasu rozróżnienia w danych całość kosztów jest w „Na zgłoszenie”.";
  const max = Math.max(1, ...series.buckets.map((b) => b.total));
  const chart =
    `<div class="bags-time-chart${stacked ? " is-dense" : ""}" aria-hidden="true">` +
    series.buckets
      .map((b) => {
        const naH = Math.round((b.report / max) * 100);
        const hH = Math.round((b.schedule / max) * 100);
        return (
          '<div class="bags-time-col"><div class="bags-time-stack">' +
          `<i class="s-h" style="height:${hH}%"></i>` +
          `<i class="s-na" style="height:${naH}%"></i></div>` +
          `<span class="wk">${escapeHtml(b.label)}</span></div>`
        );
      })
      .join("") +
    "</div>";
  const rows = series.buckets
    .map((b) => {
      const fmt = (n: number) => (money ? formatPln(n as Grosze) : String(n));
      const range = `${b.from} – ${b.to}`;
      return (
        `<tr><td>${escapeHtml(range)}</td>` +
        `<td class="num">${escapeHtml(fmt(b.report))}</td>` +
        `<td class="num">${escapeHtml(fmt(b.schedule))}</td>` +
        `<td class="num"><strong>${escapeHtml(fmt(b.total))}</strong></td></tr>`
      );
    })
    .join("");
  return (
    '<ul class="bags-time-legend">' +
    '<li><i class="c-na"></i> Na zgłoszenie</li>' +
    '<li><i class="c-h"></i> Harmonogram</li></ul>' +
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
        `<td class="num money ${tone}">${escapeHtml(formatPln(e.costPerBag))}</td></tr>`,
    )
    .join("");
  return (
    "<table><thead><tr><th>Sklep</th><th class=\"num\">Koszt za worek</th></tr></thead>" +
    `<tbody>${body || emptyRow(2)}</tbody></table>`
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
        `<td class="num">${e.pickupCount}</td></tr>`,
    )
    .join("");
  return (
    "<table><thead><tr><th>Podwykonawca</th>" +
    `<th class="num">${escapeHtml(amountHeader)}</th><th class="num">Odbiory</th></tr></thead>` +
    `<tbody>${body || emptyRow(3)}</tbody></table>`
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

function emptyRow(cols: number): string {
  return `<tr><td colspan="${cols}" class="note" style="border:none;background:transparent">Brak danych w tym okresie.</td></tr>`;
}
