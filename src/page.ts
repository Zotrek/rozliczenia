import { renderApp, renderContractorList, renderRateContractorList, renderRateShopList, emptyStats, type RangeViewModel } from "./rangeView.js";
import {
  applyNoStartDate,
  fieldsForSearch,
  foldPl,
  readWebAppUrl,
  screenAfterApprove,
  screenAfterChangeRange,
  screenAfterOpenStats,
  screenAfterSearch,
  screenAfterStatsBack,
  searchParams,
  statsParams,
  selectedContractor,
  resolveContractorText,
  startSearch,
  webAppUrl,
  blocksOnOrder,
  type ContractorListItem,
} from "./range.js";
import { rowKey } from "./engine.js";
import {
  STATEMENT_ERROR,
  UNICORN_HOLD_MS,
  adoptRows,
  approveShow,
  attachDecision,
  bagsBody,
  buildApprove,
  commitAttach,
  commitBags,
  commitDetach,
  commitRouteRate,
  currentStatement,
  detachBody,
  emptyStatement,
  findRow,
  freshStatement,
  parseAmountText,
  readSettlement,
  readSettlementStats,
  routeRateBody,
  setBagRate,
  setBagsOnly,
  setDidNotHappen,
  setPickup,
  setRouteBagRate,
  skippedCount,
  statementSums,
  tieBody,
  toggleOpen,
  toggleSelected,
  withoutTiedRates,
  writeError,
} from "./statement.js";
import { rateContractorNames, rateSaveMessage, readAddressList, resolveStoreAddress, saveRateBody, storeAddressLabel } from "./rateWindow.js";
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

const STATS_SECTION_IDS = ["bags", "costs", "q", "contractors", "empty-bags", "gaps"] as const;

function todayCalendar(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const VIEW: RangeViewModel = {
  mode: "report",
  contractorQuery: "",
  contractorOpen: false,
  contractor: "",
  contractors: [],
  from: "",
  to: "",
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
  ratesMessage: "",
  ratesMessageOk: false,
  stats: emptyStats(todayCalendar()),
};

let heldFrom = "";
let webapp = "";

function fieldByKeep(root: ParentNode, keep: string): HTMLInputElement | null {
  return (root.querySelector(`[data-keep="${keep}"]`) ??
    root.querySelector(`[data-filter="${keep}"]`)) as HTMLInputElement | null;
}

function paint(keep?: string): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  const current = keep ? fieldByKeep(document, keep) : null;
  const start = current?.selectionStart ?? null;
  const end = current?.selectionEnd ?? null;
  root.innerHTML = renderApp(VIEW);
  if (!keep) {
    return;
  }
  const next = fieldByKeep(root, keep);
  if (!next) {
    return;
  }
  next.focus();
  if (start != null && end != null) {
    next.setSelectionRange(start, end);
  }
}

function builtWebAppUrl(): string {
  const value = (globalThis as { __ROZLICZENIA_WEBAPP__?: unknown }).__ROZLICZENIA_WEBAPP__;
  return typeof value === "string" ? value.trim() : "";
}

function boot(): void {
  const read = readWebAppUrl(
    location.search,
    localStorage.getItem("rozliczenia.webapp"),
    builtWebAppUrl(),
  );
  if (read.persist) {
    localStorage.setItem("rozliczenia.webapp", read.persist);
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
  if (webapp !== "") {
    void loadContractors();
  }
}

async function loadContractors(): Promise<void> {
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Wczytuję listę podwykonawców…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, { action: "listContractors" }));
    const body = (await response.json()) as {
      ok?: boolean;
      data?: ContractorListItem[];
    };
    if (!body.ok || !Array.isArray(body.data)) {
      VIEW.contractors = [];
      VIEW.status = "Nie udało się wczytać listy podwykonawców.";
    } else {
      VIEW.contractors = body.data;
      VIEW.status = "";
    }
  } catch {
    VIEW.contractors = [];
    VIEW.status = "Nie udało się wczytać listy podwykonawców.";
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
  );
  if (!started.ok) {
    VIEW.error = started.error;
    VIEW.contractorOpen = false;
    paint();
    return;
  }
  if (webapp === "") {
    VIEW.webappMissing = true;
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
    const read = readSettlement(await response.json());
    if (!read.ok) {
      VIEW.status = read.error;
      return;
    }
    VIEW.applied = started;
    VIEW.screen = screenAfterSearch();
    VIEW.statement = freshStatement(read.rows, read.rates);
    VIEW.status = "";
    VIEW.ratesOpen = false;
  } catch {
    VIEW.status = "Wyszukanie nie doszło.";
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
    void runSearch();
  } else if (action === "back") {
    VIEW.screen = screenAfterChangeRange();
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
    const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber);
    if (!row) {
      return;
    }
    void writeNow("Odpinam sklep od trasy…", detachBody(row), () => {
      const next = commitDetach(VIEW.statement, ref.sheetRow, ref.transportNumber);
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
    const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber);
    if (!row) {
      return;
    }
    const key = rowKey(ref.sheetRow, ref.transportNumber);
    const draft = VIEW.statement.routeDraft[key] ?? { name: "", rate: "" };
    const decision = attachDecision(row, draft.name, draft.rate, VIEW.statement.leftRoute[key] ?? "");
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
      if (!refreshed) {
        VIEW.statement = { ...VIEW.statement, rates: withoutTiedRates(VIEW.statement.rates, rateRow) };
        VIEW.status = STATEMENT_ERROR.refresh;
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
    const key = rowKey(ref.sheetRow, ref.transportNumber);
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
  if (el.dataset.rate === "pickup" || el.dataset.rate === "bag" || el.dataset.rate === "from") {
    if (el.dataset.rate === "pickup") {
      VIEW.ratesPickup = el.value;
    } else if (el.dataset.rate === "bag") {
      VIEW.ratesBag = el.value;
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
  if (el.dataset.toggle === "checked") {
    const key = decodeLine(el.dataset.line ?? "");
    if (key === "") {
      return;
    }
    VIEW.statement = toggleSelected(VIEW.statement, key);
    VIEW.status = "";
    paint();
    return;
  }
  if (el.dataset.toggle === "bags-only" || el.dataset.toggle === "notrip") {
    const ref = sheetRef(el);
    if (!ref) {
      return;
    }
    VIEW.statement =
      el.dataset.toggle === "bags-only"
        ? setBagsOnly(VIEW.statement, ref.sheetRow, ref.transportNumber, el.checked)
        : setDidNotHappen(VIEW.statement, ref.sheetRow, ref.transportNumber, el.checked);
    VIEW.status = "";
    paint();
    return;
  }
  if (
    el.dataset.edit === "bags" ||
    el.dataset.edit === "pickup" ||
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

function sheetRef(el: HTMLElement): { sheetRow: number; transportNumber: string } | null {
  const sheetRow = Number(el.dataset.sheetRow);
  const transportNumber = el.dataset.transport ?? "";
  if (!Number.isInteger(sheetRow) || sheetRow < 2 || transportNumber === "") {
    return null;
  }
  return { sheetRow, transportNumber };
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
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Wczytuję adresy sklepów…";
  paint();
  try {
    const response = await fetch(webAppUrl(webapp, { action: "listStoreAddresses" }));
    const read = readAddressList(await response.json());
    if (!read.ok) {
      VIEW.addresses = [];
      VIEW.ratesShop = "";
      VIEW.ratesShopQuery = "";
      VIEW.ratesMessage = rateSaveMessage("addresses");
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
    if (VIEW.contractors.length === 0) {
      const listed = await fetch(webAppUrl(webapp, { action: "listContractors" }));
      const body = (await listed.json()) as { ok?: boolean; data?: ContractorListItem[] };
      if (body.ok && Array.isArray(body.data)) {
        VIEW.contractors = body.data;
      }
    }
    if (!rateContractorNames(VIEW.contractors).includes(VIEW.ratesContractor)) {
      VIEW.ratesContractor = "";
      VIEW.ratesContractorQuery = "";
    }
  } catch {
    VIEW.addresses = [];
    VIEW.ratesShop = "";
    VIEW.ratesShopQuery = "";
    VIEW.ratesMessage = rateSaveMessage("addresses");
  } finally {
    VIEW.loading = false;
    paint();
  }
}

async function saveRates(): Promise<void> {
  commitRateFields();
  const built = saveRateBody({
    shop: VIEW.ratesShop,
    contractor: VIEW.ratesContractor,
    pickup: VIEW.ratesPickup,
    bag: VIEW.ratesBag,
    from: VIEW.ratesFrom,
  });
  if (!built.ok) {
    VIEW.ratesMessage = rateSaveMessage(built.error);
    VIEW.ratesMessageOk = false;
    paint();
    return;
  }
  if (webapp === "") {
    VIEW.ratesMessage = "Brak adresu Web App.";
    VIEW.ratesMessageOk = false;
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = "Zapisuję stawkę…";
  paint();
  try {
    const result = await postSheet(built.body);
    if (result.ok !== true) {
      VIEW.ratesMessage = rateSaveMessage(result.error);
      VIEW.ratesMessageOk = false;
      return;
    }
    VIEW.ratesPickup = "";
    VIEW.ratesBag = "";
    VIEW.ratesFrom = "";
    VIEW.ratesMessage = "Zapisano stawkę.";
    VIEW.ratesMessageOk = true;
    if (VIEW.screen === "statement") {
      const refreshed = await reloadStatement();
      if (!refreshed) {
        VIEW.status = STATEMENT_ERROR.refresh;
      }
    }
  } catch {
    VIEW.ratesMessage = rateSaveMessage("write");
    VIEW.ratesMessageOk = false;
  } finally {
    VIEW.loading = false;
    paint();
  }
}

async function postSheet(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: unknown; pominiete?: unknown }> {
  const response = await fetch(webapp, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as { ok?: boolean; error?: unknown; pominiete?: unknown };
}

async function writeNow(
  message: string,
  body: Record<string, unknown>,
  apply: () => void | Promise<void>,
): Promise<void> {
  if (webapp === "") {
    VIEW.status = "Brak adresu Web App.";
    paint();
    return;
  }
  VIEW.loading = true;
  VIEW.loadKind = "logo";
  VIEW.loadMessage = message;
  paint();
  try {
    const result = await postSheet(body);
    if (result.ok !== true) {
      VIEW.status = writeError(result.error);
      return;
    }
    await apply();
  } catch {
    VIEW.status = STATEMENT_ERROR.write;
  } finally {
    VIEW.loading = false;
    VIEW.loadKind = "logo";
    paint();
  }
}

async function reloadStatement(): Promise<boolean> {
  if (!VIEW.applied || webapp === "") {
    return false;
  }
  const response = await fetch(webAppUrl(webapp, searchParams(VIEW.applied)));
  const read = readSettlement(await response.json());
  if (!read.ok) {
    return false;
  }
  VIEW.statement = adoptRows(VIEW.statement, read.rows, read.rates);
  return true;
}

async function commitEdit(el: HTMLInputElement): Promise<void> {
  const ref = sheetRef(el);
  if (!ref) {
    return;
  }
  const row = findRow(VIEW.statement.rows, ref.sheetRow, ref.transportNumber);
  if (!row) {
    return;
  }
  const edit = el.dataset.edit;
  if (edit === "bags") {
    const built = bagsBody(row, el.value);
    if (!built.ok) {
      VIEW.status = built.error;
      paint();
      return;
    }
    await writeNow("Zapisuję liczbę worków…", built.body, () => {
      VIEW.statement = commitBags(VIEW.statement, ref.sheetRow, ref.transportNumber, built.bagCount);
      VIEW.status = "";
    });
    return;
  }
  if (edit === "route-rate") {
    const routeName = el.dataset.route ?? row.routeName;
    const built = routeRateBody(row, routeName, el.value);
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
    VIEW.statement = setBagRate(VIEW.statement, ref.sheetRow, ref.transportNumber, amount);
  } else if (edit === "pickup") {
    VIEW.statement = setPickup(VIEW.statement, ref.sheetRow, ref.transportNumber, amount);
  }
  VIEW.status = "";
  paint();
}

async function runApprove(): Promise<void> {
  const statement = currentStatement(VIEW.statement);
  const built = buildApprove(VIEW.statement.invoice, statement, VIEW.statement.selected);
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
    if (result.ok !== true) {
      VIEW.status = writeError(result.error);
    } else if (skippedCount(result) > 0) {
      const refreshed = await reloadStatement();
      if (!refreshed) {
        VIEW.status = STATEMENT_ERROR.refresh;
      } else {
        VIEW.status = STATEMENT_ERROR.partial;
      }
    } else {
      VIEW.status = "";
      VIEW.screen = screenAfterApprove();
      VIEW.ratesOpen = false;
    }
  } catch {
    VIEW.status = STATEMENT_ERROR.write;
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
}

async function runStats(): Promise<void> {
  if (webapp === "") {
    VIEW.stats = { ...VIEW.stats, status: "Brak adresu Web App. Dopisz ?webapp= do adresu tej strony." };
    paint();
    return;
  }
  const today = todayCalendar();
  const range = resolveStatsPeriod(VIEW.stats.period, today, {
    month: VIEW.stats.month,
    from: VIEW.stats.from,
    to: VIEW.stats.to,
  });
  if (!range) {
    VIEW.stats = {
      ...VIEW.stats,
      status:
        VIEW.stats.period === "exact"
          ? "Podaj poprawny zakres od–do (data początkowa nie później niż końcowa)."
          : "Wybierz miesiąc z listy.",
    };
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
    const body: unknown = await response.json();
    const parsed = readSettlementStats(body);
    if (!parsed.ok) {
      VIEW.stats = { ...VIEW.stats, status: parsed.error, report: null };
      return;
    }
    const report = buildStatsReport(parsed.rows, parsed.rates, {
      range,
      contractor: VIEW.stats.contractor || undefined,
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
      appliedContractor: VIEW.stats.contractor,
      report,
      status: "",
      emptyBagsPage: 1,
      gapsPage: 1,
      tablesCollapsed: loadTablesCollapsed(storage, ["bags", "costs"], stacked),
    };
  } catch {
    VIEW.stats = { ...VIEW.stats, status: "Odczyt statystyk nie doszedł.", report: null };
  } finally {
    VIEW.loading = false;
    paint();
  }
}

boot();
