import { renderApp, renderContractorList, renderRateContractorList, renderRateShopList, emptyStats, type RangeViewModel } from "./rangeView.js";
import {
  applyNoStartDate,
  fieldsForSearch,
  foldPl,
  RANGE_ERROR,
  readWebAppUrl,
  screenAfterApprove,
  screenAfterWorkBack,
  invoiceParams,
  screenAfterInvoices,
  screenAfterOpenStats,
  screenAfterSearch,
  screenAfterStatsBack,
  searchParams,
  sheetToIsoDate,
  statsParams,
  selectedContractor,
  resolveContractorText,
  startSearch,
  webAppUrl,
  blocksOnOrder,
  defaultRangeDates,
  type ContractorListItem,
} from "./range.js";
import { readSettledInvoices } from "./invoices.js";
import { lineKey, rowKey, sumSelected } from "./engine.js";
import {
  STATEMENT_ERROR,
  UNICORN_HOLD_MS,
  adoptRows,
  approveShow,
  attachDecision,
  bagsBody,
  pickupDateBody,
  buildApprove,
  canPressApprove,
  commitAttach,
  commitBags,
  commitDetach,
  commitRouteRate,
  currentStatement,
  detachBody,
  emptyStatement,
  findRow,
  formatPln,
  freshStatement,
  parseAmountText,
  readSettlement,
  readSettlementStats,
  routeRateBody,
  selectedKeys,
  selectedLineCount,
  setAllSelected,
  setBagRate,
  setDidNotHappen,
  setPickup,
  setRouteBagRate,
  skippedCount,
  formatPartialApprove,
  statementSums,
  tieBody,
  toggleOpen,
  toggleSelected,
  withoutTiedRates,
  writeError,
} from "./statement.js";
import { rateContractorNames, rateSaveMessage, readAddressList, resolveStoreAddress, saveRateBody, saveRateHarmonogramBody, storeAddressLabel } from "./rateWindow.js";
import {
  buildStatsReport,
  chartShouldStack,
  resolveStatsPeriod,
  type StatsPeriodKind,
} from "./stats.js";
import {
  loadSectionsCollapsed,
  loadTablesCollapsed,
  writeStatsFold,
} from "./statsView.js";
import type { CalendarDate } from "./sheetDate.js";
import { readRozJson, showRozFailure } from "./rozErrorReport.js";

const STATS_SECTION_IDS = ["pickups", "bags", "costs", "q", "contractors", "empty-bags", "gaps"] as const;

function todayCalendar(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const todayAtBoot = todayCalendar();
const defaultDates = defaultRangeDates(todayAtBoot);

const VIEW: RangeViewModel = {
  mode: "report",
  contractorQuery: "",
  contractorOpen: false,
  contractor: "",
  contractors: [],
  from: defaultDates.from,
  to: defaultDates.to,
  noFrom: false,
  error: "",
  screen: "range",
  ratesOpen: false,
  loading: false,
  loadMessage: "",
  applied: null,
  status: "",
  webappMissing: false,
  statement: emptyStatement(),
  invoices: [],
  invoiceFocus: null,
  workReturn: "range",
  loadKind: "logo",
  addresses: [],
  ratesShop: "",
  ratesShopQuery: "",
  ratesShopOpen: false,
  ratesContractor: "",
  ratesContractorQuery: "",
  ratesContractorOpen: false,
  ratesPickup: "",
  ratesBag: "",
  ratesFrom: "",
  ratesDays: "",
  ratesTarget: "stawki",
  ratesMessage: "",
  ratesMessageOk: false,
  stats: emptyStats(todayAtBoot),
};

let heldFrom = "";
let webapp = "";

function faultText(value: unknown): string {
  if (value instanceof Error && value.message !== "") {
    return value.message;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  if (value == null || value === "") {
    return "brak szczegółu";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function reportFailure(
  code: string,
  place: string,
  summary: string,
  effect: string,
  detail: { technical?: unknown; notJson?: boolean; error?: unknown },
): void {
  showRozFailure(
    { code, place, summary, effect },
    {
      technical: faultText(detail.technical ?? detail.error),
      notJson: detail.notJson === true,
      error: detail.error,
    },
  );
}

function reportMissingWebApp(place: string): void {
  if (typeof document !== "undefined" && document.querySelector('[data-roz-code="ROZ-E-WEBAPP"]')) {
    return;
  }
  reportFailure(
    "ROZ-E-WEBAPP",
    place,
    "Brak adresu Web App.",
    "Bez adresu lista, wyszukanie, podgląd faktur, stawki i statystyki nie dojdą. Dopisz ?webapp= do adresu tej strony albo ustaw adres przy buildzie.",
    { technical: "webapp empty" },
  );
}

function fieldByKeep(root: ParentNode, keep: string): HTMLInputElement | null {
  return (root.querySelector(`[data-keep="${keep}"]`) ??
    root.querySelector(`[data-filter="${keep}"]`)) as HTMLInputElement | null;
}

/** Przewinięcie listy zestawienia. Przebudowa HTML tworzy nowy kontener i bez tego wraca na górę. */
function readListScroll(): { top: number; left: number } | null {
  const wrap = document.querySelector(".table-wrap");
  if (!(wrap instanceof HTMLElement)) {
    return null;
  }
  return { top: wrap.scrollTop, left: wrap.scrollLeft };
}

let listScrollGen = 0;

function writeListScroll(scroll: { top: number; left: number } | null): void {
  if (!scroll) {
    return;
  }
  const apply = (): void => {
    const wrap = document.querySelector(".table-wrap");
    if (!(wrap instanceof HTMLElement)) {
      return;
    }
    wrap.scrollTop = scroll.top;
    wrap.scrollLeft = scroll.left;
  };
  apply();
  const gen = ++listScrollGen;
  requestAnimationFrame(() => {
    if (gen !== listScrollGen) {
      return;
    }
    apply();
  });
}

function paint(keep?: string): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  const scroll = readListScroll();
  const current = keep ? fieldByKeep(document, keep) : null;
  const start = current?.selectionStart ?? null;
  const end = current?.selectionEnd ?? null;
  root.innerHTML = renderApp(VIEW);
  if (keep) {
    const next = fieldByKeep(root, keep);
    if (next) {
      next.focus({ preventScroll: true });
      if (start != null && end != null) {
        next.setSelectionRange(start, end);
      }
    }
  }
  writeListScroll(scroll);
  const focused = root.querySelector(".invoice-card.is-focus");
  if (focused instanceof HTMLElement) {
    focused.scrollIntoView({ block: "nearest" });
  }
}

/** Zaznaczenie nie przebudowuje listy: zostaje przewinięcie i fokus na checkboxie. */
function syncCheckedRows(): void {
  const root = document.querySelector(".statement");
  if (!(root instanceof HTMLElement)) {
    paint();
    return;
  }
  root.querySelector(":scope > p.status-block")?.remove();
  const statement = currentStatement(VIEW.statement);
  const selected = VIEW.statement.selected;
  for (const line of statement.lines) {
    const key = lineKey(line);
    const box = root.querySelector(
      `input[data-toggle="checked"][data-line="${CSS.escape(encodeURIComponent(key))}"]`,
    );
    const row = box?.closest("tr");
    if (!(box instanceof HTMLInputElement) || !row) {
      paint();
      return;
    }
    const on = selected[key] === true;
    box.checked = on;
    row.classList.toggle("is-checked", on);
  }
  const all = root.querySelector('input[data-toggle="checked-all"]');
  if (all instanceof HTMLInputElement) {
    all.checked =
      statement.lines.length > 0 && statement.lines.every((line) => selected[lineKey(line)] === true);
  }
  const countEl = root.querySelector('[data-out="sel-count"]');
  const sumEl = root.querySelector('[data-out="sum-sel"]');
  if (!countEl || !sumEl) {
    paint();
    return;
  }
  const count = selectedLineCount(statement, selected);
  countEl.textContent = String(count);
  sumEl.textContent = formatPln(sumSelected(statement, selectedKeys(selected)));
  const approve = root.querySelector('[data-action="approve"]');
  if (approve instanceof HTMLButtonElement) {
    approve.disabled = !canPressApprove(VIEW.statement.invoice, count);
  }
}

function builtWebAppUrl(): string {
  const value = (globalThis as { __ROZLICZENIA_WEBAPP__?: unknown }).__ROZLICZENIA_WEBAPP__;
  return typeof value === "string" ? value.trim() : "";
}

function boot(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("rozliczenia.webapp");
  } catch (err) {
    reportFailure(
      "ROZ-E-STORAGE",
      "page.ts boot",
      "Nie udało się odczytać zapisanego adresu Web App.",
      "Strona użyje adresu z buildu albo z ?webapp=. Adres z poprzedniej wizyty nie wszedł.",
      { technical: err },
    );
  }
  const read = readWebAppUrl(location.search, stored, builtWebAppUrl());
  if (read.persist) {
    try {
      localStorage.setItem("rozliczenia.webapp", read.persist);
    } catch (err) {
      reportFailure(
        "ROZ-E-STORAGE",
        "page.ts boot",
        "Nie udało się zapamiętać adresu Web App.",
        "Adres działa w tej wizycie. Po odświeżeniu trzeba podać go jeszcze raz.",
        { technical: err },
      );
    }
  }
  webapp = read.url;
  VIEW.webappMissing = webapp === "";
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("mousedown", onMouseDown);
  root.addEventListener("keydown", onKeyDown);
  paint();
  if (webapp === "") {
    reportMissingWebApp("page.ts boot");
    return;
  }
  void loadContractors();
}

async function loadContractors(): Promise<void> {
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Wczytuję listę podwykonawców…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, { action: "listContractors" }));
    const parsed = await readRozJson(response);
    if (!parsed.ok) {
      VIEW.contractors = [];
      if (!parsed.silent) {
        VIEW.status = "Nie udało się wczytać listy podwykonawców.";
        reportFailure(
          "ROZ-E-CONTRACTORS",
          "page.ts loadContractors",
          "Nie udało się wczytać listy podwykonawców.",
          "Lista jest pusta. Bez niej nie wybierzesz podwykonawcy.",
          parsed,
        );
      }
      return;
    }
    const body = parsed.body as {
      ok?: boolean;
      data?: ContractorListItem[];
      error?: unknown;
    };
    if (!body.ok || !Array.isArray(body.data)) {
      VIEW.contractors = [];
      VIEW.status = "Nie udało się wczytać listy podwykonawców.";
      reportFailure(
        "ROZ-E-CONTRACTORS",
        "page.ts loadContractors",
        "Nie udało się wczytać listy podwykonawców.",
        "Lista jest pusta. Bez niej nie wybierzesz podwykonawcy.",
        { error: body.error, technical: body.error ?? "ok: false" },
      );
    } else {
      VIEW.contractors = body.data;
      VIEW.status = "";
    }
  } catch (err) {
    VIEW.contractors = [];
    VIEW.status = "Nie udało się wczytać listy podwykonawców.";
    reportFailure(
      "ROZ-E-CONTRACTORS",
      "page.ts loadContractors",
      "Nie udało się wczytać listy podwykonawców.",
      "Lista jest pusta. Bez niej nie wybierzesz podwykonawcy.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

async function runSearch(): Promise<void> {
  const started = startSearch(
    fieldsForSearch({
      contractor: VIEW.contractor,
      from: VIEW.from,
      to: VIEW.to,
      noFrom: VIEW.noFrom,
    }),
    VIEW.contractors,
    VIEW.mode,
  );
  if (!started.ok) {
    failRangeStart(started.error);
    return;
  }
  if (webapp === "") {
    VIEW.webappMissing = true;
    reportMissingWebApp("page.ts runSearch");
    paint();
    return;
  }
  VIEW.error = "";
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Szukam nierozliczonych odbiorów…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, searchParams(started)));
    const parsed = await readRozJson(response);
    if (!parsed.ok) {
      if (!parsed.silent) {
        failOpen("Wyszukanie nie doszło.");
        reportFailure(
          "ROZ-E-SEARCH",
          "page.ts runSearch",
          "Wyszukanie nie doszło.",
          "Zestawienie się nie zmieniło. Możesz poprawić zakres i szukać jeszcze raz.",
          parsed,
        );
      }
      return;
    }
    const read = readSettlement(parsed.body);
    if (!read.ok) {
      failOpen(read.error);
      reportFailure(
        "ROZ-E-SEARCH",
        "page.ts runSearch",
        "Wyszukanie nie doszło.",
        "Zestawienie się nie zmieniło. Możesz poprawić zakres i szukać jeszcze raz.",
        { technical: read.error },
      );
      return;
    }
    VIEW.applied = started;
    VIEW.screen = screenAfterSearch();
    VIEW.statement = freshStatement(read.rows, read.rates);
    if (VIEW.workReturn === "stats" && VIEW.invoiceFocus) {
      VIEW.statement = { ...VIEW.statement, invoice: VIEW.invoiceFocus };
    }
    VIEW.status = "";
    VIEW.stats = { ...VIEW.stats, status: "" };
    VIEW.ratesOpen = false;
  } catch (err) {
    failOpen("Wyszukanie nie doszło.");
    reportFailure(
      "ROZ-E-SEARCH",
      "page.ts runSearch",
      "Wyszukanie nie doszło.",
      "Zestawienie się nie zmieniło. Możesz poprawić zakres i szukać jeszcze raz.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

function failOpen(message: string): void {
  if (VIEW.workReturn === "stats") {
    VIEW.stats = { ...VIEW.stats, status: message };
    VIEW.screen = "stats";
    VIEW.status = "";
    return;
  }
  VIEW.status = message;
}

function failRangeStart(error: keyof typeof RANGE_ERROR): void {
  if (VIEW.workReturn === "stats") {
    failOpen(RANGE_ERROR[error]);
  } else {
    VIEW.error = error;
    VIEW.screen = "range";
  }
  VIEW.contractorOpen = false;
  paint();
}

/** Podgląd i edycja z tabeli odbiorów: ten podwykonawca, tryb wiersza, okres raportu. */
function armPickupWork(el: HTMLElement): boolean {
  const from = sheetToIsoDate(VIEW.stats.appliedFrom);
  const to = sheetToIsoDate(VIEW.stats.appliedTo);
  if (!from || !to) {
    VIEW.stats = { ...VIEW.stats, status: "Najpierw pokaż raport." };
    paint();
    return false;
  }
  VIEW.mode = el.dataset.mode === "schedule" ? "schedule" : "report";
  VIEW.contractor = el.dataset.contractor ?? "";
  VIEW.contractorQuery = VIEW.contractor;
  VIEW.contractorOpen = false;
  VIEW.from = from;
  VIEW.to = to;
  VIEW.noFrom = false;
  VIEW.workReturn = "stats";
  VIEW.error = "";
  VIEW.invoiceFocus = el.dataset.invoiceKnown === "1" ? (el.dataset.invoice ?? "") : null;
  return true;
}

async function runInvoices(): Promise<void> {
  const started = startSearch(
    fieldsForSearch({
      contractor: VIEW.contractor,
      from: VIEW.from,
      to: VIEW.to,
      noFrom: VIEW.noFrom,
    }),
    VIEW.contractors,
    VIEW.mode,
  );
  if (!started.ok) {
    failRangeStart(started.error);
    return;
  }
  if (webapp === "") {
    VIEW.webappMissing = true;
    reportMissingWebApp("page.ts runInvoices");
    paint();
    return;
  }
  VIEW.error = "";
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Szukam rozliczonych faktur…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, invoiceParams(started)));
    const parsed = await readRozJson(response);
    if (!parsed.ok) {
      if (!parsed.silent) {
        failOpen("Odczyt faktur nie doszedł.");
        reportFailure(
          "ROZ-E-INVOICES",
          "page.ts runInvoices",
          "Odczyt faktur nie doszedł.",
          "Podgląd się nie zmienił. Możesz poprawić zakres i otworzyć go jeszcze raz.",
          parsed,
        );
      }
      return;
    }
    const read = readSettledInvoices(parsed.body);
    if (!read.ok) {
      failOpen(read.error);
      reportFailure(
        "ROZ-E-INVOICES",
        "page.ts runInvoices",
        "Odczyt faktur nie doszedł.",
        "Podgląd się nie zmienił. Możesz poprawić zakres i otworzyć go jeszcze raz.",
        { technical: read.error },
      );
      return;
    }
    VIEW.applied = started;
    VIEW.screen = screenAfterInvoices();
    VIEW.invoices = read.rows;
    VIEW.status = "";
    VIEW.stats = { ...VIEW.stats, status: "" };
    VIEW.ratesOpen = false;
  } catch (err) {
    failOpen("Odczyt faktur nie doszedł.");
    reportFailure(
      "ROZ-E-INVOICES",
      "page.ts runInvoices",
      "Odczyt faktur nie doszedł.",
      "Podgląd się nie zmienił. Możesz poprawić zakres i otworzyć go jeszcze raz.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (
    target.closest(".modal-panel") &&
    !target.closest("[data-action='close-rates']") &&
    !target.closest("[data-action='save-rates']")
  ) {
    return;
  }
  const el = target.closest("[data-action]");
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const action = el.dataset.action;
  if (action === "pick-contractor") {
    pickContractor(el.dataset.nazwa ?? "");
  } else if (action === "search") {
    VIEW.workReturn = "range";
    VIEW.invoiceFocus = null;
    void runSearch();
  } else if (action === "invoice-preview") {
    if (armPickupWork(el)) {
      void runInvoices();
    }
  } else if (action === "invoice-edit") {
    if (armPickupWork(el)) {
      void runSearch();
    }
  } else if (action === "back") {
    VIEW.screen = screenAfterWorkBack(VIEW.workReturn);
    VIEW.loading = false;
    VIEW.ratesOpen = false;
    paint();
  } else if (action === "stats") {
    openStats();
  } else if (action === "stats-back") {
    VIEW.screen = screenAfterStatsBack();
    VIEW.loading = false;
    VIEW.ratesOpen = false;
    VIEW.stats = { ...VIEW.stats, status: "" };
    paint();
  } else if (action === "stats-period") {
    const period = el.dataset.period as StatsPeriodKind | undefined;
    if (!period) {
      return;
    }
    VIEW.stats = { ...VIEW.stats, period, status: "" };
    paint();
  } else if (action === "stats-show") {
    void runStats();
  } else if (action === "stats-fold") {
    toggleStatsSection(el.dataset.fold ?? "");
  } else if (action === "stats-table-fold") {
    toggleStatsTable(el.dataset.tableFold ?? "");
  } else if (action === "stats-page") {
    shiftStatsPage(el.dataset.pager ?? "", el.dataset.dir ?? "");
  } else if (action === "rates") {
    void openRates();
  } else if (action === "rates-tab") {
    const target = el.dataset.target === "harmonogram" ? "harmonogram" : "stawki";
    VIEW.ratesTarget = target;
    VIEW.ratesMessage = "";
    VIEW.ratesMessageOk = false;
    paint();
  } else if (action === "close-rates") {
    VIEW.ratesOpen = false;
    VIEW.ratesMessage = "";
    VIEW.ratesMessageOk = false;
    paint();
  } else if (action === "save-rates") {
    void saveRates();
  } else if (action === "expand") {
    const routeName = el.dataset.route ?? "";
    if (routeName === "") {
      return;
    }
    VIEW.statement = toggleOpen(VIEW.statement, routeName);
    paint();
  } else if (action === "detach") {
    const ref = sheetRef(el);
    if (!ref) {
      return;
    }
    const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber, ref.sheetName);
    if (!row) {
      return;
    }
    void writeNow("Odpinam sklep od trasy…", detachBody(row, VIEW.mode), () => {
      const next = commitDetach(VIEW.statement, ref.sheetRow, ref.transportNumber, ref.sheetName);
      if (next) {
        VIEW.statement = next;
      }
      VIEW.status = "";
    });
  } else if (action === "attach") {
    const ref = sheetRef(el);
    if (!ref) {
      return;
    }
    const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber, ref.sheetName);
    if (!row) {
      return;
    }
    const key = rowKey(ref.sheetRow, ref.transportNumber, ref.sheetName);
    const draft = VIEW.statement.routeDraft[key] ?? { name: "", rate: "" };
    const decision = attachDecision(
      row,
      draft.name,
      draft.rate,
      VIEW.statement.leftRoute[key] ?? "",
      VIEW.mode,
    );
    if (!decision.ok) {
      VIEW.statement = {
        ...VIEW.statement,
        routeDraftError: { ...VIEW.statement.routeDraftError, [key]: decision.error },
      };
      paint();
      return;
    }
    void writeNow("Zapisuję nową trasę…", decision.body, () => {
      const next = commitAttach(
        VIEW.statement,
        ref.sheetRow,
        ref.transportNumber,
        decision.name,
        decision.grosze,
        ref.sheetName,
      );
      if (next) {
        VIEW.statement = next;
      }
      VIEW.status = "";
    });
  } else if (action === "resolve-tie") {
    const rateRow = Number(el.dataset.rateRow);
    if (!Number.isInteger(rateRow)) {
      return;
    }
    void writeNow("Rozstrzygam remis stawek…", tieBody(rateRow), async () => {
      const refreshed = await reloadStatement();
      if (!refreshed.ok) {
        VIEW.statement = { ...VIEW.statement, rates: withoutTiedRates(VIEW.statement.rates, rateRow) };
        VIEW.status = STATEMENT_ERROR.refresh;
        if (!refreshed.silent) {
          reportFailure(
            "ROZ-E-REFRESH",
            "page.ts resolve-tie",
            STATEMENT_ERROR.refresh,
            "Remis mógł już zniknąć z arkusza. Lista na ekranie może być nieaktualna — szukaj jeszcze raz.",
            refreshed,
          );
        }
        return;
      }
      VIEW.status = "";
    });
  } else if (action === "approve") {
    void runApprove();
  }
}

function onInput(event: Event): void {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (el.dataset.edit === "invoice") {
    VIEW.statement = { ...VIEW.statement, invoice: el.value };
    VIEW.status = "";
    paint("invoice");
    return;
  }
  if (el.dataset.draft === "route-name" || el.dataset.draft === "route-rate") {
    const ref = sheetRef(el);
    if (!ref) {
      return;
    }
    const key = rowKey(ref.sheetRow, ref.transportNumber, ref.sheetName);
    const prev = VIEW.statement.routeDraft[key] ?? { name: "", rate: "" };
    const draft =
      el.dataset.draft === "route-name" ? { ...prev, name: el.value } : { ...prev, rate: el.value };
    const routeDraftError = { ...VIEW.statement.routeDraftError };
    delete routeDraftError[key];
    VIEW.statement = {
      ...VIEW.statement,
      routeDraft: { ...VIEW.statement.routeDraft, [key]: draft },
      routeDraftError,
    };
    paint(el.dataset.keep);
    return;
  }
  if (el.dataset.rate === "shop" || el.dataset.rate === "contractor") {
    typeRateField(el);
    return;
  }
  if (el.dataset.rate === "pickup" || el.dataset.rate === "bag" || el.dataset.rate === "from" || el.dataset.rate === "days") {
    if (el.dataset.rate === "pickup") {
      VIEW.ratesPickup = el.value;
    } else if (el.dataset.rate === "bag") {
      VIEW.ratesBag = el.value;
    } else if (el.dataset.rate === "days") {
      VIEW.ratesDays = el.value;
    } else {
      VIEW.ratesFrom = el.value;
    }
    paint(el.dataset.keep);
    return;
  }
  if (el.dataset.filter === "contractor") {
    VIEW.contractorQuery = el.value;
    const picked = selectedContractor(VIEW.contractors, el.value);
    VIEW.contractor = picked ? picked.nazwa : "";
    VIEW.contractorOpen = true;
    if (VIEW.error === "contractor") {
      VIEW.error = "";
    }
    syncContractorPicker();
    return;
  }
  if (el.dataset.filter === "from" || el.dataset.filter === "to") {
    syncDate(el);
  }
}

function syncDate(el: HTMLInputElement): void {
  if (el.dataset.filter === "from") {
    VIEW.from = el.value;
  }
  if (el.dataset.filter === "to") {
    VIEW.to = el.value;
  }
  if (VIEW.error === "end" && VIEW.to !== "") {
    VIEW.error = "";
  }
  if (VIEW.error === "order" && !blocksOnOrder(VIEW.from, VIEW.to, VIEW.noFrom)) {
    VIEW.error = "";
  }
  paint(el.dataset.filter);
}

function onChange(event: Event): void {
  const el = event.target;
  if (el instanceof HTMLSelectElement && el.dataset.stats) {
    applyStatsField(el.dataset.stats, el.value);
    return;
  }
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (el.dataset.stats === "from" || el.dataset.stats === "to") {
    applyStatsField(el.dataset.stats, el.value);
    return;
  }
  if (el.dataset.toggle === "checked-all") {
    VIEW.statement = setAllSelected(VIEW.statement, el.checked);
    VIEW.status = "";
    syncCheckedRows();
    return;
  }
  if (el.dataset.toggle === "checked") {
    const key = decodeLine(el.dataset.line ?? "");
    if (key === "") {
      return;
    }
    VIEW.statement = toggleSelected(VIEW.statement, key);
    VIEW.status = "";
    syncCheckedRows();
    return;
  }
  if (el.dataset.toggle === "notrip") {
    const ref = sheetRef(el);
    if (!ref) {
      return;
    }
    VIEW.statement = setDidNotHappen(
      VIEW.statement,
      ref.sheetRow,
      ref.transportNumber,
      el.checked,
      ref.sheetName,
    );
    VIEW.status = "";
    paint();
    return;
  }
  if (
    el.dataset.edit === "bags" ||
    el.dataset.edit === "pickup" ||
    el.dataset.edit === "pickup-date" ||
    el.dataset.edit === "route-date" ||
    el.dataset.edit === "bag-rate" ||
    el.dataset.edit === "bag-rate-route" ||
    el.dataset.edit === "route-rate"
  ) {
    void commitEdit(el);
    return;
  }
  if (el.id === "mode-na") {
    VIEW.mode = "report";
    paint();
    return;
  }
  if (el.id === "mode-h") {
    VIEW.mode = "schedule";
    paint();
    return;
  }
  if (el.dataset.toggle === "nofrom") {
    const next = applyNoStartDate({ from: VIEW.from, held: heldFrom }, el.checked);
    VIEW.from = next.from;
    heldFrom = next.held;
    VIEW.noFrom = el.checked;
    if (el.checked && VIEW.error === "order") {
      VIEW.error = "";
    }
    paint();
    return;
  }
  if (el.dataset.filter === "from" || el.dataset.filter === "to") {
    syncDate(el);
  }
}

function pickContractor(nazwa: string): void {
  if (nazwa === "") {
    return;
  }
  VIEW.contractor = nazwa;
  VIEW.contractorQuery = nazwa;
  VIEW.contractorOpen = false;
  if (VIEW.error === "contractor") {
    VIEW.error = "";
  }
  paint();
}

type RateField = "shop" | "contractor";

function typeRateField(el: HTMLInputElement): void {
  const field: RateField = el.dataset.rate === "shop" ? "shop" : "contractor";
  if (field === "shop") {
    VIEW.ratesShopQuery = el.value;
    const resolved = resolveStoreAddress(VIEW.addresses, el.value);
    VIEW.ratesShop =
      foldPl(el.value) !== "" && foldPl(resolved.query) === foldPl(el.value) ? resolved.address : "";
    VIEW.ratesShopOpen = true;
    VIEW.ratesContractorOpen = false;
  } else {
    VIEW.ratesContractorQuery = el.value;
    const picked = selectedContractor(VIEW.contractors, el.value);
    VIEW.ratesContractor = picked ? picked.nazwa : "";
    VIEW.ratesContractorOpen = true;
    VIEW.ratesShopOpen = false;
  }
  VIEW.ratesMessage = "";
  VIEW.ratesMessageOk = false;
  syncRatesMessage();
  syncRatePicker("shop");
  syncRatePicker("contractor");
}

function commitRateField(field: RateField): void {
  if (field === "shop") {
    const resolved = resolveStoreAddress(VIEW.addresses, VIEW.ratesShopQuery);
    VIEW.ratesShop = resolved.address;
    VIEW.ratesShopQuery = resolved.query;
    VIEW.ratesShopOpen = false;
    return;
  }
  const resolved = resolveContractorText(VIEW.contractors, VIEW.ratesContractorQuery);
  VIEW.ratesContractor = resolved.contractor;
  VIEW.ratesContractorQuery = resolved.query;
  VIEW.ratesContractorOpen = false;
}

function commitRateFields(): void {
  commitRateField("shop");
  commitRateField("contractor");
}

function pickRateValue(field: RateField, value: string): void {
  if (value === "") {
    return;
  }
  if (field === "shop") {
    const picked = VIEW.addresses.find((item) => item.address === value);
    VIEW.ratesShop = value;
    VIEW.ratesShopQuery = picked ? storeAddressLabel(picked) : value;
    VIEW.ratesShopOpen = false;
  } else {
    VIEW.ratesContractor = value;
    VIEW.ratesContractorQuery = value;
    VIEW.ratesContractorOpen = false;
  }
  VIEW.ratesMessage = "";
  VIEW.ratesMessageOk = false;
  paint();
}

function onFocusIn(event: FocusEvent): void {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (el.dataset.filter === "contractor") {
    VIEW.contractorOpen = true;
    syncContractorPicker();
    return;
  }
  if (el.dataset.rate !== "shop" && el.dataset.rate !== "contractor") {
    return;
  }
  if (el.dataset.rate === "shop") {
    VIEW.ratesShopOpen = true;
    VIEW.ratesContractorOpen = false;
  } else {
    VIEW.ratesContractorOpen = true;
    VIEW.ratesShopOpen = false;
  }
  syncRatePicker("shop");
  syncRatePicker("contractor");
}

function onFocusOut(event: FocusEvent): void {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (el.dataset.filter === "contractor") {
    window.setTimeout(() => {
      const still = document.activeElement;
      if (still instanceof HTMLInputElement && still.dataset.filter === "contractor") {
        return;
      }
      const resolved = resolveContractorText(VIEW.contractors, VIEW.contractorQuery);
      VIEW.contractor = resolved.contractor;
      VIEW.contractorQuery = resolved.query;
      VIEW.contractorOpen = false;
      const input = document.querySelector('[data-filter="contractor"]');
      if (input instanceof HTMLInputElement) {
        input.value = VIEW.contractorQuery;
      }
      syncContractorPicker();
    }, 150);
    return;
  }
  if (el.dataset.rate !== "shop" && el.dataset.rate !== "contractor") {
    return;
  }
  const field: RateField = el.dataset.rate === "shop" ? "shop" : "contractor";
  window.setTimeout(() => {
    const still = document.activeElement;
    if (still instanceof HTMLInputElement && still.dataset.rate === field) {
      return;
    }
    commitRateField(field);
    const input = document.querySelector(`[data-window="rates"] [data-rate="${field}"]`);
    if (input instanceof HTMLInputElement) {
      input.value = field === "shop" ? VIEW.ratesShopQuery : VIEW.ratesContractorQuery;
    }
    syncRatePicker("shop");
    syncRatePicker("contractor");
  }, 150);
}

function contractorOptions(): HTMLElement[] {
  const box = document.querySelector("[data-picker-list]");
  if (!(box instanceof HTMLElement)) {
    return [];
  }
  return [...box.querySelectorAll<HTMLElement>("[data-action='pick-contractor']")];
}

function moveContractorActive(delta: number): void {
  if (!VIEW.contractorOpen) {
    VIEW.contractorOpen = true;
    syncContractorPicker();
  }
  const items = contractorOptions();
  if (!items.length) {
    return;
  }
  const current = items.findIndex((item) => item.classList.contains("is-active"));
  const next =
    current < 0
      ? delta > 0
        ? 0
        : items.length - 1
      : Math.min(items.length - 1, Math.max(0, current + delta));
  for (let i = 0; i < items.length; i += 1) {
    items[i].classList.toggle("is-active", i === next);
  }
  items[next].scrollIntoView({ block: "nearest" });
}

function rateOptions(field: RateField): HTMLElement[] {
  const box = document.querySelector(`[data-rate-list="${field}"]`);
  if (!(box instanceof HTMLElement)) {
    return [];
  }
  return [...box.querySelectorAll<HTMLElement>("[role='option']")];
}

function moveRateActive(field: RateField, delta: number): void {
  if (field === "shop") {
    VIEW.ratesShopOpen = true;
    VIEW.ratesContractorOpen = false;
  } else {
    VIEW.ratesContractorOpen = true;
    VIEW.ratesShopOpen = false;
  }
  syncRatePicker("shop");
  syncRatePicker("contractor");
  const items = rateOptions(field);
  if (!items.length) {
    return;
  }
  const current = items.findIndex((item) => item.classList.contains("is-active"));
  const next =
    current < 0
      ? delta > 0
        ? 0
        : items.length - 1
      : Math.min(items.length - 1, Math.max(0, current + delta));
  for (let i = 0; i < items.length; i += 1) {
    items[i].classList.toggle("is-active", i === next);
  }
  items[next].scrollIntoView({ block: "nearest" });
}

function onKeyDown(event: KeyboardEvent): void {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (el.dataset.filter === "contractor") {
    if (event.key === "Escape") {
      VIEW.contractorOpen = false;
      syncContractorPicker();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveContractorActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && VIEW.contractorOpen) {
      const active = contractorOptions().find((item) => item.classList.contains("is-active"));
      const pick = active ?? contractorOptions()[0];
      if (!pick) {
        return;
      }
      event.preventDefault();
      pickContractor(pick.dataset.nazwa ?? "");
    }
    return;
  }
  if (el.dataset.rate !== "shop" && el.dataset.rate !== "contractor") {
    return;
  }
  const field: RateField = el.dataset.rate === "shop" ? "shop" : "contractor";
  const open = field === "shop" ? VIEW.ratesShopOpen : VIEW.ratesContractorOpen;
  if (event.key === "Escape") {
    if (field === "shop") {
      VIEW.ratesShopOpen = false;
    } else {
      VIEW.ratesContractorOpen = false;
    }
    syncRatePicker(field);
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveRateActive(field, event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "Enter" && open) {
    const items = rateOptions(field);
    const active = items.find((item) => item.classList.contains("is-active"));
    const pick = active ?? items[0];
    if (!pick) {
      return;
    }
    event.preventDefault();
    pickRateValue(field, pick.dataset.value ?? "");
  }
}

function syncContractorPicker(): void {
  const input = document.querySelector('[data-filter="contractor"]');
  const box = document.querySelector("[data-picker-list]");
  if (!(input instanceof HTMLInputElement) || !(box instanceof HTMLElement)) {
    return;
  }
  input.setAttribute("aria-expanded", VIEW.contractorOpen ? "true" : "false");
  const picked = selectedContractor(VIEW.contractors, VIEW.contractor);
  const note = document.querySelector("[data-contractor-note]");
  if (note instanceof HTMLElement) {
    const show = picked !== null && !VIEW.contractorOpen;
    note.hidden = !show;
    note.textContent = show && picked ? picked.dane : "";
  }
  const field = input.closest(".picker");
  if (field instanceof HTMLElement) {
    field.classList.toggle("is-error", VIEW.error === "contractor");
    if (VIEW.error !== "contractor") {
      field.querySelector("[data-contractor-error]")?.remove();
    }
  }
  if (!VIEW.contractorOpen) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = renderContractorList(VIEW);
}

function syncRatesMessage(): void {
  const el = document.querySelector("[data-rates-message]");
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.hidden = VIEW.ratesMessage === "";
  el.textContent = VIEW.ratesMessage;
  el.className = VIEW.ratesMessageOk ? "note" : "err";
}

function syncRatePicker(field: RateField): void {
  const input = document.querySelector(`[data-window="rates"] [data-rate="${field}"]`);
  const box = document.querySelector(`[data-rate-list="${field}"]`);
  if (!(input instanceof HTMLInputElement) || !(box instanceof HTMLElement)) {
    return;
  }
  const open = field === "shop" ? VIEW.ratesShopOpen : VIEW.ratesContractorOpen;
  input.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = field === "shop" ? renderRateShopList(VIEW) : renderRateContractorList(VIEW);
}

function onMouseDown(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const ratePick = target.closest("[data-action='pick-rate-shop'], [data-action='pick-rate-contractor']");
  if (ratePick instanceof HTMLElement) {
    event.preventDefault();
    const field: RateField = ratePick.dataset.action === "pick-rate-shop" ? "shop" : "contractor";
    pickRateValue(field, ratePick.dataset.value ?? "");
    return;
  }
  const pick = target.closest("[data-action='pick-contractor']");
  if (!(pick instanceof HTMLElement)) {
    return;
  }
  event.preventDefault();
  pickContractor(pick.dataset.nazwa ?? "");
}

function sheetRef(
  el: HTMLElement,
): { sheetName: string; sheetRow: number; transportNumber: string } | null {
  const sheetRow = Number(el.dataset.sheetRow);
  const transportNumber = el.dataset.transport ?? "";
  const sheetName = el.dataset.sheetName ?? "";
  // Harmonogram: brak nr zlecenia — wystarczy sheetName + sheetRow (+ puste transportNumber).
  if (!Number.isInteger(sheetRow) || sheetRow < 2) {
    return null;
  }
  return { sheetName, sheetRow, transportNumber };
}

function decodeLine(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

async function openRates(): Promise<void> {
  VIEW.ratesOpen = true;
  VIEW.ratesShopOpen = false;
  VIEW.ratesContractorOpen = false;
  VIEW.ratesShopQuery = VIEW.ratesShop;
  VIEW.ratesContractorQuery = VIEW.ratesContractor;
  VIEW.ratesMessage = "";
  VIEW.ratesMessageOk = false;
  if (webapp === "") {
    VIEW.ratesMessage = "Brak adresu Web App.";
    VIEW.ratesMessageOk = false;
    reportMissingWebApp("page.ts openRates");
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Wczytuję adresy sklepów…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, { action: "listStoreAddresses" }));
    const parsed = await readRozJson(response);
    if (!parsed.ok) {
      VIEW.addresses = [];
      VIEW.ratesShop = "";
      VIEW.ratesShopQuery = "";
      if (!parsed.silent) {
        VIEW.ratesMessage = rateSaveMessage("addresses");
        reportFailure(
          "ROZ-E-ADDRESSES",
          "page.ts openRates",
          "Nie udało się wczytać adresów.",
          "Okno stawek jest bez listy sklepów. Zapis stawki poczeka na adresy.",
          parsed,
        );
      }
    } else {
      const read = readAddressList(parsed.body);
      if (!read.ok) {
        VIEW.addresses = [];
        VIEW.ratesShop = "";
        VIEW.ratesShopQuery = "";
        VIEW.ratesMessage = rateSaveMessage("addresses");
        reportFailure(
          "ROZ-E-ADDRESSES",
          "page.ts openRates",
          "Nie udało się wczytać adresów.",
          "Okno stawek jest bez listy sklepów. Zapis stawki poczeka na adresy.",
          { technical: "ok: false" },
        );
      } else {
        VIEW.addresses = read.addresses;
        const current = read.addresses.find((item) => item.address === VIEW.ratesShop);
        if (!current) {
          VIEW.ratesShop = "";
          VIEW.ratesShopQuery = "";
        } else {
          VIEW.ratesShopQuery = storeAddressLabel(current);
        }
      }
    }
    if (VIEW.contractors.length === 0) {
      const listed = await fetch(webAppUrl(webapp, { action: "listContractors" }));
      const listedParsed = await readRozJson(listed);
      if (!listedParsed.ok) {
        if (!listedParsed.silent) {
          reportFailure(
            "ROZ-E-CONTRACTORS",
            "page.ts openRates",
            "Nie udało się wczytać listy podwykonawców.",
            "Lista w oknie stawek zostaje pusta.",
            listedParsed,
          );
        }
      } else {
        const body = listedParsed.body as { ok?: boolean; data?: ContractorListItem[]; error?: unknown };
        if (body.ok && Array.isArray(body.data)) {
          VIEW.contractors = body.data;
        } else {
          reportFailure(
            "ROZ-E-CONTRACTORS",
            "page.ts openRates",
            "Nie udało się wczytać listy podwykonawców.",
            "Lista w oknie stawek zostaje pusta.",
            { error: body.error, technical: body.error ?? "ok: false" },
          );
        }
      }
    }
    if (!rateContractorNames(VIEW.contractors).includes(VIEW.ratesContractor)) {
      VIEW.ratesContractor = "";
      VIEW.ratesContractorQuery = "";
    }
  } catch (err) {
    VIEW.addresses = [];
    VIEW.ratesShop = "";
    VIEW.ratesShopQuery = "";
    VIEW.ratesMessage = rateSaveMessage("addresses");
    reportFailure(
      "ROZ-E-ADDRESSES",
      "page.ts openRates",
      "Nie udało się wczytać adresów.",
      "Okno stawek jest bez listy sklepów. Zapis stawki poczeka na adresy.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

async function saveRates(): Promise<void> {
  commitRateFields();
  const common = {
    shop: VIEW.ratesShop,
    contractor: VIEW.ratesContractor,
    pickup: VIEW.ratesPickup,
    bag: VIEW.ratesBag,
    from: VIEW.ratesFrom,
  };
  const built =
    VIEW.ratesTarget === "harmonogram"
      ? saveRateHarmonogramBody({ ...common, days: VIEW.ratesDays })
      : saveRateBody(common);
  if (!built.ok) {
    VIEW.ratesMessage = rateSaveMessage(built.error);
    VIEW.ratesMessageOk = false;
    paint();
    return;
  }
  if (webapp === "") {
    VIEW.ratesMessage = "Brak adresu Web App.";
    VIEW.ratesMessageOk = false;
    reportMissingWebApp("page.ts saveRates");
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = VIEW.ratesTarget === "harmonogram" ? "Zapisuję stawkę harmonogramu…" : "Zapisuję stawkę…";
  paint();
  try {
    const result = await postSheet(built.body);
    if (result.error === "unauthorized") {
      return;
    }
    if (result.ok !== true) {
      VIEW.ratesMessage = rateSaveMessage(result.error);
      VIEW.ratesMessageOk = false;
      reportFailure(
        "ROZ-E-RATE-SAVE",
        "page.ts saveRates",
        rateSaveMessage(result.error),
        "Stawka nie weszła do bazy. Poprzednie stawki zostają.",
        { error: result.error, technical: result.technical ?? result.error, notJson: result.notJson === true },
      );
      return;
    }
    VIEW.ratesPickup = "";
    VIEW.ratesBag = "";
    VIEW.ratesFrom = "";
    VIEW.ratesDays = "";
    VIEW.ratesMessage =
      VIEW.ratesTarget === "harmonogram" ? "Zapisano stawkę harmonogramu." : "Zapisano stawkę.";
    VIEW.ratesMessageOk = true;
    if (VIEW.screen === "statement") {
      const refreshed = await reloadStatement();
      if (!refreshed.ok) {
        VIEW.status = STATEMENT_ERROR.refresh;
        if (!refreshed.silent) {
          reportFailure(
            "ROZ-E-REFRESH",
            "page.ts saveRates",
            STATEMENT_ERROR.refresh,
            "Stawka jest zapisana. Lista odbiorów na ekranie może być nieaktualna — szukaj jeszcze raz.",
            refreshed,
          );
        }
      }
    }
  } catch (err) {
    VIEW.ratesMessage = rateSaveMessage("write");
    VIEW.ratesMessageOk = false;
    reportFailure(
      "ROZ-E-RATE-SAVE",
      "page.ts saveRates",
      rateSaveMessage("write"),
      "Stawka nie weszła do bazy. Poprzednie stawki zostają.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

async function postSheet(body: Record<string, unknown>): Promise<{
  ok?: boolean;
  error?: unknown;
  pominiete?: unknown;
  zapisane?: unknown;
  notJson?: boolean;
  technical?: string;
}> {
  const response = await fetch(webapp, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  const parsed = await readRozJson(response);
  if (!parsed.ok) {
    if (parsed.silent) {
      return { ok: false, error: "unauthorized" };
    }
    return { ok: false, error: "not_json", notJson: true, technical: parsed.technical };
  }
  if (!parsed.body || typeof parsed.body !== "object") {
    return { ok: false, error: "not_json", notJson: true, technical: "pusta odpowiedź" };
  }
  return parsed.body as {
    ok?: boolean;
    error?: unknown;
    pominiete?: unknown;
    zapisane?: unknown;
  };
}

async function writeNow(
  message: string,
  body: Record<string, unknown>,
  apply: () => void | Promise<void>,
): Promise<void> {
  if (webapp === "") {
    VIEW.status = "Brak adresu Web App.";
    reportMissingWebApp("page.ts writeNow");
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = message;
  paint();
  try {
    const result = await postSheet(body);
    if (result.error === "unauthorized") {
      return;
    }
    if (result.ok !== true) {
      VIEW.status = writeError(result.error);
      reportFailure(
        "ROZ-E-WRITE",
        "page.ts writeNow",
        writeError(result.error),
        "Ten zapis nie wszedł do arkusza. Reszta zestawienia zostaje.",
        {
          error: result.error,
          technical: `${String(body.action ?? "zapis")}: ${faultText(result.technical ?? result.error)}`,
          notJson: result.notJson === true,
        },
      );
      return;
    }
    await apply();
  } catch (err) {
    VIEW.status = STATEMENT_ERROR.write;
    reportFailure(
      "ROZ-E-WRITE",
      "page.ts writeNow",
      STATEMENT_ERROR.write,
      "Ten zapis nie wszedł do arkusza. Reszta zestawienia zostaje.",
      { technical: `${String(body.action ?? "zapis")}: ${faultText(err)}` },
    );
  } finally {
    VIEW.loading = false;
    VIEW.loadKind = "logo";
    paint();
  }
}

async function reloadStatement(): Promise<
  { ok: true } | { ok: false; silent: true } | { ok: false; silent: false; notJson: boolean; technical: string }
> {
  if (!VIEW.applied || webapp === "") {
    return { ok: false, silent: false, notJson: false, technical: "brak zakresu albo adresu Web App" };
  }
  try {
    const response = await fetch(webAppUrl(webapp, searchParams(VIEW.applied)));
    const parsed = await readRozJson(response);
    if (!parsed.ok) {
      if (parsed.silent) {
        return { ok: false, silent: true };
      }
      return { ok: false, silent: false, notJson: true, technical: parsed.technical };
    }
    const read = readSettlement(parsed.body);
    if (!read.ok) {
      return { ok: false, silent: false, notJson: false, technical: read.error };
    }
    VIEW.statement = adoptRows(VIEW.statement, read.rows, read.rates);
    return { ok: true };
  } catch (err) {
    return { ok: false, silent: false, notJson: false, technical: faultText(err) };
  }
}

async function commitEdit(el: HTMLInputElement): Promise<void> {
  const ref = sheetRef(el);
  if (!ref) {
    return;
  }
  const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber, ref.sheetName);
  if (!row) {
    return;
  }
  const edit = el.dataset.edit;
  if (edit === "bags") {
    const built = bagsBody(row, el.value, VIEW.mode);
    if (!built.ok) {
      VIEW.status = built.error;
      paint();
      return;
    }
    await writeNow("Zapisuję liczbę worków…", built.body, () => {
      VIEW.statement = commitBags(
        VIEW.statement,
        ref.sheetRow,
        ref.transportNumber,
        built.bagCount,
        ref.sheetName,
      );
      VIEW.status = "";
    });
    return;
  }
  if (edit === "route-rate") {
    const routeName = el.dataset.route ?? row.routeName;
    const built = routeRateBody(row, routeName, el.value, VIEW.mode);
    if (!built.ok) {
      VIEW.status = built.error;
      paint();
      return;
    }
    await writeNow("Zapisuję stawkę trasy…", built.body, () => {
      VIEW.statement = commitRouteRate(VIEW.statement, routeName, built.grosze);
      VIEW.status = "";
    });
    return;
  }
  if (edit === "pickup-date" || edit === "route-date") {
    const routeName = el.dataset.route ?? "";
    const targets =
      edit === "route-date" ? VIEW.statement.rows.filter((item) => routeName !== "" && item.routeName === routeName) : [row];
    const built = pickupDateBody(targets, el.value, VIEW.mode);
    if (!built.ok) {
      VIEW.status = built.error;
      paint();
      return;
    }
    if (built.unchanged) {
      VIEW.status = "";
      return;
    }
    await writeNow("Zapisuję datę odbioru…", built.body, async () => {
      const refreshed = await reloadStatement();
      if (!refreshed.ok) {
        VIEW.status = STATEMENT_ERROR.refresh;
        return;
      }
      VIEW.status = "";
    });
    return;
  }
  const parsed = parseAmountText(el.value);
  if (parsed.kind === "bad") {
    VIEW.status = STATEMENT_ERROR.badRate;
    paint();
    return;
  }
  const amount = parsed.kind === "empty" ? null : parsed.value;
  if (edit === "bag-rate-route") {
    const routeName = el.dataset.route ?? "";
    if (routeName === "") {
      return;
    }
    VIEW.statement = setRouteBagRate(VIEW.statement, routeName, amount);
  } else if (edit === "bag-rate") {
    VIEW.statement = setBagRate(
      VIEW.statement,
      ref.sheetRow,
      ref.transportNumber,
      amount,
      ref.sheetName,
    );
  } else if (edit === "pickup") {
    VIEW.statement = setPickup(
      VIEW.statement,
      ref.sheetRow,
      ref.transportNumber,
      amount,
      ref.sheetName,
    );
  }
  VIEW.status = "";
  paint();
}

async function runApprove(): Promise<void> {
  const statement = currentStatement(VIEW.statement);
  const built = buildApprove(VIEW.statement.invoice, statement, VIEW.statement.selected, VIEW.mode);
  if (!built.ok) {
    VIEW.status = STATEMENT_ERROR[built.error];
    paint();
    return;
  }
  const kind = approveShow(statementSums(VIEW.statement).selected);
  const started = Date.now();
  VIEW.loading = true;
  VIEW.loadKind = kind;
  VIEW.loadMessage = "Zatwierdzam rozliczenie…";
  VIEW.status = "";
  paint();
  try {
    const result = await postSheet(built.body);
    if (result.error === "unauthorized") {
      return;
    }
    if (result.ok !== true) {
      VIEW.status = writeError(result.error);
      reportFailure(
        "ROZ-E-APPROVE",
        "page.ts runApprove",
        writeError(result.error),
        "Rozliczenie nie zostało zatwierdzone. Zaznaczenie i numer faktury zostają.",
        { error: result.error, technical: result.technical ?? result.error, notJson: result.notJson === true },
      );
    } else if (skippedCount(result) > 0) {
      const refreshed = await reloadStatement();
      const partial = formatPartialApprove(result);
      if (!refreshed.ok) {
        VIEW.status = STATEMENT_ERROR.refresh;
        if (!refreshed.silent) {
          reportFailure(
            "ROZ-E-REFRESH",
            "page.ts runApprove",
            STATEMENT_ERROR.refresh,
            "Część wierszy mogła już wejść. Lista na ekranie może być nieaktualna — szukaj jeszcze raz.",
            { technical: `${refreshed.technical} | ${partial}`, notJson: refreshed.notJson },
          );
        }
      } else {
        VIEW.status = partial;
        reportFailure(
          "ROZ-E-APPROVE-PARTIAL",
          "page.ts runApprove",
          STATEMENT_ERROR.partial,
          "Zapisane wiersze są rozliczone. Pominięte trzeba poprawić i zatwierdzić jeszcze raz.",
          { technical: partial },
        );
      }
    } else {
      VIEW.status = "";
      VIEW.screen = screenAfterApprove();
      VIEW.ratesOpen = false;
    }
  } catch (err) {
    VIEW.status = STATEMENT_ERROR.write;
    reportFailure(
      "ROZ-E-APPROVE",
      "page.ts runApprove",
      STATEMENT_ERROR.write,
      "Rozliczenie nie zostało zatwierdzone. Zaznaczenie i numer faktury zostają.",
      { technical: err },
    );
  } finally {
    if (kind === "unicorn") {
      const left = UNICORN_HOLD_MS - (Date.now() - started);
      if (left > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, left);
        });
      }
    }
    VIEW.loading = false;
    VIEW.loadKind = "logo";
    paint();
  }
}

function openStats(): void {
  const today = todayCalendar();
  const storage = typeof localStorage !== "undefined" ? localStorage : null;
  VIEW.stats = {
    ...emptyStats(today),
    contractors: VIEW.contractors,
    contractor: VIEW.contractor,
    sectionsCollapsed: loadSectionsCollapsed(storage, STATS_SECTION_IDS),
  };
  VIEW.screen = screenAfterOpenStats();
  VIEW.ratesOpen = false;
  VIEW.status = "";
  paint();
  void runStats();
}

function applyStatsField(field: string, value: string): void {
  if (field === "month") {
    VIEW.stats = { ...VIEW.stats, month: value };
  } else if (field === "quarter") {
    VIEW.stats = { ...VIEW.stats, quarter: value };
  } else if (field === "from") {
    VIEW.stats = { ...VIEW.stats, from: value };
  } else if (field === "to") {
    VIEW.stats = { ...VIEW.stats, to: value };
  } else if (field === "contractor") {
    VIEW.stats = { ...VIEW.stats, contractor: value };
  } else {
    return;
  }
  paint();
}

function toggleStatsSection(id: string): void {
  if (id === "") {
    return;
  }
  const collapsed = !(VIEW.stats.sectionsCollapsed[id] === true);
  VIEW.stats = {
    ...VIEW.stats,
    sectionsCollapsed: { ...VIEW.stats.sectionsCollapsed, [id]: collapsed },
  };
  writeStatsFold(
    typeof localStorage !== "undefined" ? localStorage : null,
    `section.${id}`,
    collapsed ? "closed" : "open",
  );
  paint();
}

function toggleStatsTable(id: string): void {
  if (id === "") {
    return;
  }
  const currently = VIEW.stats.tablesCollapsed[id] ?? true;
  const collapsed = !currently;
  VIEW.stats = {
    ...VIEW.stats,
    tablesCollapsed: { ...VIEW.stats.tablesCollapsed, [id]: collapsed },
  };
  writeStatsFold(
    typeof localStorage !== "undefined" ? localStorage : null,
    `table.${id}`,
    collapsed ? "closed" : "open",
  );
  paint();
}

function shiftStatsPage(pager: string, dir: string): void {
  if (pager === "empty-bags") {
    const next = VIEW.stats.emptyBagsPage + (dir === "next" ? 1 : -1);
    VIEW.stats = { ...VIEW.stats, emptyBagsPage: Math.max(1, next) };
    paint();
    return;
  }
  if (pager === "gaps") {
    const next = VIEW.stats.gapsPage + (dir === "next" ? 1 : -1);
    VIEW.stats = { ...VIEW.stats, gapsPage: Math.max(1, next) };
    paint();
    return;
  }
  if (pager === "pickups") {
    const next = VIEW.stats.pickupsPage + (dir === "next" ? 1 : -1);
    VIEW.stats = { ...VIEW.stats, pickupsPage: Math.max(1, next) };
    paint();
    return;
  }
}

async function runStats(): Promise<void> {
  if (webapp === "") {
    VIEW.stats = { ...VIEW.stats, status: "Brak adresu Web App. Dopisz ?webapp= do adresu tej strony." };
    reportMissingWebApp("page.ts runStats");
    paint();
    return;
  }
  const today = todayCalendar();
  const range = resolveStatsPeriod(VIEW.stats.period, today, {
    month: VIEW.stats.month,
    quarter: VIEW.stats.quarter,
    from: VIEW.stats.from,
    to: VIEW.stats.to,
  });
  if (!range) {
    const status =
      VIEW.stats.period === "exact"
        ? "Podaj poprawny zakres od–do (data początkowa nie później niż końcowa)."
        : VIEW.stats.period === "prevQuarter"
          ? "Wybierz kwartał z listy."
          : "Wybierz miesiąc z listy.";
    VIEW.stats = { ...VIEW.stats, status };
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Ładuję dane…";
  VIEW.stats = { ...VIEW.stats, status: "" };
  paint();
  try {
    const response = await fetch(
      webAppUrl(
        webapp,
        statsParams({
          dataOd: range.from,
          dataDo: range.to,
          podwykonawca: VIEW.stats.contractor,
        }),
      ),
    );
    const loaded = await readRozJson(response);
    if (!loaded.ok) {
      if (!loaded.silent) {
        VIEW.stats = { ...VIEW.stats, status: "Odczyt statystyk nie doszedł.", report: null };
        reportFailure(
          "ROZ-E-STATS",
          "page.ts runStats",
          "Odczyt statystyk nie doszedł.",
          "Wykresy zostają puste albo przy poprzednim odczycie. Możesz zmienić okres i spróbować jeszcze raz.",
          loaded,
        );
      }
      return;
    }
    const parsed = readSettlementStats(loaded.body);
    if (!parsed.ok) {
      VIEW.stats = { ...VIEW.stats, status: parsed.error, report: null };
      reportFailure(
        "ROZ-E-STATS",
        "page.ts runStats",
        "Odczyt statystyk nie doszedł.",
        "Wykresy zostają puste albo przy poprzednim odczycie. Możesz zmienić okres i spróbować jeszcze raz.",
        { technical: parsed.error },
      );
      return;
    }
    const report = buildStatsReport(parsed.rows, parsed.rates, {
      range,
      contractor: VIEW.stats.contractor || undefined,
      asOf: today,
    });
    const storage = typeof localStorage !== "undefined" ? localStorage : null;
    const stacked = {
      bags: chartShouldStack(report.bagsOverTime),
      costs: chartShouldStack(report.costsOverTime),
    };
    VIEW.stats = {
      ...VIEW.stats,
      today,
      appliedFrom: range.from,
      appliedTo: range.to,
      appliedKind: VIEW.stats.period,
      appliedMonth: VIEW.stats.month,
      appliedQuarter: VIEW.stats.quarter,
      appliedContractor: VIEW.stats.contractor,
      report,
      status: "",
      emptyBagsPage: 1,
      gapsPage: 1,
      pickupsPage: 1,
      tablesCollapsed: loadTablesCollapsed(storage, ["bags", "costs"], stacked),
    };
  } catch (err) {
    VIEW.stats = { ...VIEW.stats, status: "Odczyt statystyk nie doszedł.", report: null };
    reportFailure(
      "ROZ-E-STATS",
      "page.ts runStats",
      "Odczyt statystyk nie doszedł.",
      "Wykresy zostają puste albo przy poprzednim odczycie. Możesz zmienić okres i spróbować jeszcze raz.",
      { technical: err },
    );
  } finally {
    VIEW.loading = false;
    paint();
  }
}

boot();
