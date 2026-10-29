import { escapeHtml } from "./html.js";
import { filterLedgerInvoices, type LedgerMode } from "./ledger.js";
import { modeLabel, type ContractorListItem } from "./range.js";
import { formatPln } from "./statement.js";
import {
  pageSlice,
  previousMonthOptions,
  previousQuarterOptions,
  statsPeriodKindLabel,
  type MonthOption,
  type PeriodInvoice,
  type QuarterOption,
  type StatsPeriodKind,
} from "./stats.js";
import {
  columnBar,
  columnHead,
  emptyLedgerTable,
  invoiceCellText,
  invoiceColumnChoices,
  pickupQueryHits,
  renderLedgerColumnMenu,
  visiblePeriodInvoices,
  type InvoiceColumnKey,
  type InvoiceTableState,
} from "./statsView.js";
import type { CalendarDate } from "./sheetDate.js";

export const LEDGER_PAGE_SIZE = 20;

const LEDGER_COLUMNS: readonly { key: InvoiceColumnKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Numer", numeric: false },
  { key: "contractor", label: "Podwykonawca", numeric: false },
  { key: "mode", label: "Sposób odbioru", numeric: false },
  { key: "approved", label: "Data zatwierdzenia", numeric: false },
  { key: "date", label: "Data odbioru", numeric: false },
  { key: "bags", label: "Worki", numeric: true },
  { key: "amount", label: "Kwota", numeric: true },
];

export interface LedgerViewModel {
  period: StatsPeriodKind;
  month: string;
  quarter: string;
  from: string;
  to: string;
  contractor: string;
  contractors: readonly ContractorListItem[];
  months: readonly MonthOption[];
  quarters: readonly QuarterOption[];
  /** Fragment numeru. Działa na wczytanej liście, bez nowego odczytu. */
  invoiceQuery: string;
  mode: LedgerMode;
  appliedFrom: string;
  appliedTo: string;
  appliedKind: StatsPeriodKind;
  appliedMonth: string;
  appliedQuarter: string;
  appliedContractor: string;
  /** `null` = odczytu jeszcze nie było. */
  invoices: readonly PeriodInvoice[] | null;
  status: string;
  page: number;
  table: InvoiceTableState;
}

export function defaultLedgerView(
  today: CalendarDate,
  over: Partial<LedgerViewModel> = {},
): LedgerViewModel {
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
    invoiceQuery: "",
    mode: "all",
    appliedFrom: "",
    appliedTo: "",
    appliedKind: "current",
    appliedMonth: month,
    appliedQuarter: quarter,
    appliedContractor: "",
    invoices: null,
    status: "",
    page: 1,
    table: emptyLedgerTable(),
    ...over,
  };
}

export function renderLedgerScreen(model: LedgerViewModel): string {
  return (
    '<div class="stats" data-screen="ledger">' +
    ledgerFilters(model) +
    ledgerBody(model) +
    "</div>"
  );
}

function ledgerFilters(model: LedgerViewModel): string {
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
        `data-action="ledger-period" data-period="${chip.id}">${chip.label}</button>`,
    )
    .join("");
  const modes: { id: LedgerMode; label: string }[] = [
    { id: "all", label: "Wszystkie" },
    { id: "report", label: "Na zgłoszenie" },
    { id: "schedule", label: "Harmonogram" },
  ];
  const modeHtml = modes
    .map(
      (chip) =>
        `<button type="button" class="chip${model.mode === chip.id ? " is-on" : ""}" ` +
        `data-action="ledger-mode" data-mode="${chip.id}">${chip.label}</button>`,
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
    '<div class="field" style="flex: 1 1 100%;"><span>Okres odbioru</span>' +
    `<div class="period-chips" role="group" aria-label="Okres">${chipHtml}</div></div>` +
    `<div class="field month-pick${model.period === "prev" ? " is-on" : ""}">` +
    '<label for="ledger-month">Miesiąc</label>' +
    `<select id="ledger-month" data-ledger="month">${monthOpts}</select></div>` +
    `<div class="field quarter-pick${model.period === "prevQuarter" ? " is-on" : ""}">` +
    '<label for="ledger-quarter">Kwartał</label>' +
    `<select id="ledger-quarter" data-ledger="quarter">${quarterOpts}</select></div>` +
    `<div class="exact-range${model.period === "exact" ? " is-on" : ""}">` +
    '<div class="field"><label for="ledger-from">Od</label>' +
    `<input id="ledger-from" type="date" data-ledger="from" value="${escapeHtml(model.from)}"></div>` +
    '<div class="field"><label for="ledger-to">Do</label>' +
    `<input id="ledger-to" type="date" data-ledger="to" value="${escapeHtml(model.to)}"></div></div>` +
    '<div class="field"><label for="ledger-who">Podwykonawca</label>' +
    `<select id="ledger-who" data-ledger="contractor">${whoOpts}</select></div>` +
    '<div class="field"><label for="ledger-number">Numer faktury</label>' +
    `<input id="ledger-number" type="text" data-keep="ledger-number" value="${escapeHtml(model.invoiceQuery)}" ` +
    'placeholder="Fragment numeru" autocomplete="off"></div>' +
    '<div class="field" style="flex: 1 1 100%;"><span>Sposób odbioru</span>' +
    `<div class="period-chips" role="group" aria-label="Sposób odbioru">${modeHtml}</div></div>` +
    '<button type="button" class="btn-teal" data-action="ledger-show">Pokaż</button>' +
    "</div>"
  );
}

function ledgerBody(model: LedgerViewModel): string {
  const status = model.status ? `<p class="err">${escapeHtml(model.status)}</p>` : "";
  if (!model.invoices) {
    return (
      `<div class="body">${status}` +
      '<p class="period-label">Wybierz okres i naciśnij <strong>Pokaż</strong>.</p></div>'
    );
  }
  const who = model.appliedContractor === "" ? "Wszyscy" : model.appliedContractor;
  const kindLabel = statsPeriodKindLabel(model.appliedKind, model.appliedMonth, model.appliedQuarter);
  const periodLabel =
    `Odbiory: <strong>${escapeHtml(model.appliedFrom)} – ${escapeHtml(model.appliedTo)}</strong>` +
    ` (${escapeHtml(kindLabel)}) · podwykonawca: <strong>${escapeHtml(who)}</strong>`;
  return `<div class="body">${status}<p class="period-label">${periodLabel}</p>${ledgerTable(model)}</div>`;
}

function ledgerTable(model: LedgerViewModel): string {
  const source = model.invoices ?? [];
  const narrowed = filterLedgerInvoices(source, model.invoiceQuery, model.mode).slice().sort((a, b) =>
    a.invoice.localeCompare(b.invoice, "pl", { numeric: true, sensitivity: "base" }),
  );
  const shown = visiblePeriodInvoices(narrowed, model.table);
  const paged = pageSlice(shown, model.page, LEDGER_PAGE_SIZE);
  const body = paged.slice
    .map((row) => {
      const bags = row.bagCount === null ? "—" : String(row.bagCount);
      const amount = row.amount === null ? "—" : formatPln(row.amount);
      return (
        `<tr><td class="shop">${escapeHtml(row.invoice)}</td>` +
        `<td>${escapeHtml(row.contractor)}</td>` +
        `<td>${escapeHtml(modeLabel(row.mode))}</td>` +
        `<td>${escapeHtml(invoiceCellText(row, "approved"))}</td>` +
        `<td>${escapeHtml(row.pickupDate)}</td>` +
        `<td class="num">${escapeHtml(bags)}</td>` +
        `<td class="num">${escapeHtml(amount)}</td>` +
        `<td>${ledgerLinks(row)}</td></tr>`
      );
    })
    .join("");
  const empty =
    source.length === 0 ? "Brak faktur w tym okresie." : "Brak pozycji dla tego filtra.";
  return (
    ledgerBar(model.table) +
    "<table><thead><tr>" +
    ledgerHead(model) +
    "<th></th>" +
    `</tr></thead><tbody>${body || emptyRow(LEDGER_COLUMNS.length + 1, empty)}</tbody></table>` +
    ledgerPager(paged) +
    '<p class="note" style="margin: 10px 12px 12px;">' +
    "Każdy wiersz to jeden numer faktury u jednego podwykonawcy i w jednym sposobie odbioru. " +
    "Lista jest od najnowszej daty zatwierdzenia. Faktury sprzed tej daty są na końcu. " +
    "Okres dotyczy daty odbioru, więc stare faktury bez daty zatwierdzenia też widać. " +
    "Podgląd nic nie zapisuje. Edycja otwiera zestawienie z tym numerem. " +
    `Po ${LEDGER_PAGE_SIZE} pozycji na stronę.</p>`
  );
}

function ledgerLinks(row: PeriodInvoice): string {
  const attrs =
    ` data-contractor="${escapeHtml(row.contractor)}"` +
    ` data-mode="${row.mode}"` +
    ` data-invoice="${escapeHtml(row.invoice)}"` +
    ' data-invoice-known="1"';
  return (
    '<div class="row-links">' +
    `<button type="button" data-action="invoice-preview"${attrs}>Podgląd</button>` +
    `<button type="button" data-action="invoice-edit"${attrs}>Edycja</button>` +
    "</div>"
  );
}

function ledgerHead(model: LedgerViewModel): string {
  return columnHead(LEDGER_COLUMNS, model.table, true, "ledger", (key) => ledgerMenu(model, key));
}

function ledgerMenu(model: LedgerViewModel, column: InvoiceColumnKey): string {
  const menu = model.table.menu;
  if (!model.invoices || !menu || menu.column !== column) {
    return "";
  }
  const narrowed = filterLedgerInvoices(model.invoices, model.invoiceQuery, model.mode).slice().sort((a, b) =>
    a.invoice.localeCompare(b.invoice, "pl", { numeric: true, sensitivity: "base" }),
  );
  const choices = invoiceColumnChoices(narrowed, model.table.filters, column);
  const visible = choices.filter((text) => pickupQueryHits(text, menu.query));
  const label = LEDGER_COLUMNS.find((item) => item.key === column)?.label ?? column;
  return renderLedgerColumnMenu({
    column,
    label,
    sortDir: model.table.sortKey === column ? model.table.sortDir : null,
    hasFilter: model.table.filters[column] != null,
    query: menu.query,
    visible,
    picked: new Set(menu.draft),
  });
}

function ledgerBar(state: InvoiceTableState): string {
  const defaultSort = state.sortKey === "approved" && state.sortDir === "desc";
  const shown = defaultSort ? { ...state, sortKey: null } : state;
  return columnBar(LEDGER_COLUMNS, shown, "ledger", ledgerSortPhrase);
}

function ledgerSortPhrase(key: InvoiceColumnKey, dir: "asc" | "desc"): string {
  if (key === "date" || key === "approved") {
    return dir === "asc" ? "od najstarszych" : "od najnowszych";
  }
  if (key === "bags" || key === "amount") {
    return dir === "asc" ? "od najmniejszych" : "od największych";
  }
  return dir === "asc" ? "od A do Z" : "od Z do A";
}

function ledgerPager(paged: { page: number; pages: number; total: number }): string {
  if (paged.total <= LEDGER_PAGE_SIZE) {
    return `<div class="pager" data-pager="ledger" hidden></div>`;
  }
  const from = (paged.page - 1) * LEDGER_PAGE_SIZE + 1;
  const to = Math.min(paged.page * LEDGER_PAGE_SIZE, paged.total);
  const meta = `Pozycje ${from}–${to} z ${paged.total} · po ${LEDGER_PAGE_SIZE} na stronę`;
  return (
    `<div class="pager" data-pager="ledger">` +
    `<span class="meta">${escapeHtml(meta)}</span>` +
    '<div class="nav">' +
    `<button type="button" data-action="ledger-page" data-dir="prev"` +
    `${paged.page <= 1 ? " disabled" : ""}>← Poprzednia</button>` +
    `<span class="page-label">${paged.page} / ${paged.pages}</span>` +
    `<button type="button" data-action="ledger-page" data-dir="next"` +
    `${paged.page >= paged.pages ? " disabled" : ""}>Następna →</button>` +
    "</div></div>"
  );
}

function emptyRow(cols: number, message: string): string {
  return `<tr><td colspan="${cols}" class="note" style="border:none;background:transparent">${escapeHtml(message)}</td></tr>`;
}
