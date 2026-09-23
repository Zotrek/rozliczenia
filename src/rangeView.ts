import { escapeHtml } from "./html.js";
import { matchingStoreAddresses, storeAddressLabel, type StoreAddress } from "./rateWindow.js";
import {
  RANGE_ERROR,
  foldPl,
  matchingContractors,
  modeLabel,
  rangeLabel,
  selectedContractor,
  type ContractorListItem,
  type RangeError,
  type ScreenId,
  type SettlementMode,
  type StartedSearch,
} from "./range.js";
import type { StatementScreen } from "./statement.js";
import { renderStatement } from "./statementView.js";
import { defaultStatsView, renderStatsScreen, type StatsViewModel } from "./statsView.js";
import type { CalendarDate } from "./sheetDate.js";

export interface RangeViewModel {
  mode: SettlementMode;
  contractorQuery: string;
  contractorOpen: boolean;
  contractor: string;
  contractors: readonly ContractorListItem[];
  from: string;
  to: string;
  noFrom: boolean;
  error: RangeError | "";
  screen: ScreenId;
  ratesOpen: boolean;
  loading: boolean;
  loadMessage: string;
  applied: StartedSearch | null;
  status: string;
  webappMissing: boolean;
  statement: StatementScreen;
  /** Od 10 000 zł przy Zatwierdź. Inaczej pulsujące logo. */
  loadKind?: "logo" | "unicorn";
  /** Kolumna Adres sklepu i nazwa z kolumny Sklep. Zapis idzie adresem. */
  addresses: readonly StoreAddress[];
  ratesShop: string;
  ratesShopQuery: string;
  ratesShopOpen: boolean;
  ratesContractor: string;
  ratesContractorQuery: string;
  ratesContractorOpen: boolean;
  ratesPickup: string;
  ratesBag: string;
  ratesFrom: string;
  ratesMessage: string;
  ratesMessageOk: boolean;
  stats: StatsViewModel;
}


function brand(mode: SettlementMode): string {
  return (
    '<div class="brand"><img src="logo.png" alt="" width="36" height="36">' +
    `<div><strong>Rozliczenia</strong><em>${escapeHtml(modeLabel(mode))}</em></div></div>`
  );
}

export function renderModes(mode: SettlementMode = "report"): string {
  const reportOn = mode === "report";
  const scheduleOn = mode === "schedule";
  return (
    '<div class="modes" role="group" aria-label="Tryb">' +
    `<label class="mode${reportOn ? " is-on" : " is-off"}">` +
    `<input type="checkbox" id="mode-na"${reportOn ? " checked" : ""}> Na zgłoszenie</label>` +
    `<label class="mode${scheduleOn ? " is-on" : " is-off"}">` +
    `<input type="checkbox" id="mode-h"${scheduleOn ? " checked" : ""}> Harmonogram</label></div>`
  );
}

export const CONTRACTOR_LIST_LIMIT = 80;

function contractorHits(model: RangeViewModel) {
  const browsing =
    model.contractorOpen &&
    model.contractor !== "" &&
    foldPl(model.contractorQuery) === foldPl(model.contractor);
  return matchingContractors(model.contractors, model.contractorQuery, browsing).slice(
    0,
    CONTRACTOR_LIST_LIMIT,
  );
}

/** Lista pod polem: najwyżej 80 krótkich nazw. Dane do Worda tylko zawężają. */
export function renderContractorList(model: RangeViewModel): string {
  const hits = contractorHits(model);
  if (!hits.length) {
    return '<p class="note picker-empty">Brak podwykonawcy o tej nazwie lub w danych do Worda.</p>';
  }
  return (
    '<ul class="picker-list" id="contractor-list">' +
    hits
      .map(
        (item) =>
          `<li><button type="button" class="picker-option" role="option" data-action="pick-contractor" data-nazwa="${escapeHtml(item.nazwa)}">` +
          `<span>${escapeHtml(item.nazwa)}</span></button></li>`,
      )
      .join("") +
    "</ul>"
  );
}

function contractorField(model: RangeViewModel): string {
  const picked = selectedContractor(model.contractors, model.contractor);
  const err = model.error === "contractor";
  const note = picked ? escapeHtml(picked.dane) : "";
  return (
    `<div class="field picker${err ? " is-error" : ""}"><span>Podwykonawca</span>` +
    '<div class="picker-wrap">' +
    `<input type="text" data-filter="contractor" value="${escapeHtml(model.contractorQuery)}" ` +
    'placeholder="Nazwa lub dane do Worda" autocomplete="off" role="combobox" aria-autocomplete="list" ' +
    `aria-expanded="${model.contractorOpen ? "true" : "false"}" aria-controls="contractor-list">` +
    `<div data-picker-list${model.contractorOpen ? "" : " hidden"}>${model.contractorOpen ? renderContractorList(model) : ""}</div>` +
    "</div>" +
    `<span class="note" data-contractor-note${picked && !model.contractorOpen ? "" : " hidden"}>${note}</span>` +
    (err ? `<span class="err" data-contractor-error>${RANGE_ERROR.contractor}</span>` : "") +
    "</div>"
  );
}

function renderOptionList(
  listId: string,
  action: string,
  values: readonly (string | { value: string; text: string })[],
  empty: string,
): string {
  if (!values.length) {
    return `<p class="note picker-empty">${empty}</p>`;
  }
  return (
    `<ul class="picker-list" id="${listId}">` +
    values
      .map((item) => {
        const choice = typeof item === "string" ? { value: item, text: item } : item;
        return (
          `<li><button type="button" class="picker-option" role="option" data-action="${action}" data-value="${escapeHtml(choice.value)}">` +
          `<span>${escapeHtml(choice.text)}</span></button></li>`
        );
      })
      .join("") +
    "</ul>"
  );
}

function rateShopHits(model: RangeViewModel): { value: string; text: string }[] {
  const selected = model.addresses.find((item) => item.address === model.ratesShop);
  const selectedLabel = selected ? storeAddressLabel(selected) : "";
  const browsing =
    model.ratesShopOpen &&
    model.ratesShop !== "" &&
    foldPl(model.ratesShopQuery) === foldPl(selectedLabel);
  return matchingStoreAddresses(model.addresses, model.ratesShopQuery, browsing)
    .slice(0, CONTRACTOR_LIST_LIMIT)
    .map((item) => ({ value: item.address, text: storeAddressLabel(item) }));
}

/** Adresy z rejestru. Najwyżej 80. Tekstu spoza listy nie ma. */
export function renderRateShopList(model: RangeViewModel): string {
  return renderOptionList(
    "rate-shop-list",
    "pick-rate-shop",
    rateShopHits(model),
    "Brak adresu o tym fragmencie.",
  );
}

function rateContractorHits(model: RangeViewModel): string[] {
  const browsing =
    model.ratesContractorOpen &&
    model.ratesContractor !== "" &&
    foldPl(model.ratesContractorQuery) === foldPl(model.ratesContractor);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of matchingContractors(model.contractors, model.ratesContractorQuery, browsing)) {
    const name = item.nazwa.trim();
    if (name === "" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
    if (names.length >= CONTRACTOR_LIST_LIMIT) {
      break;
    }
  }
  return names;
}

/** Nazwa krótka. Dane do Worda tylko zawężają i nie wchodzą do listy. */
export function renderRateContractorList(model: RangeViewModel): string {
  return renderOptionList(
    "rate-contractor-list",
    "pick-rate-contractor",
    rateContractorHits(model),
    "Brak podwykonawcy o tej nazwie lub w danych do Worda.",
  );
}

function rateCombo(
  label: string,
  field: "shop" | "contractor",
  query: string,
  open: boolean,
  placeholder: string,
  listHtml: string,
): string {
  return (
    `<div class="field picker"><span>${label}</span>` +
    '<div class="picker-wrap">' +
    `<input type="text" data-rate="${field}" value="${escapeHtml(query)}" ` +
    `placeholder="${placeholder}" autocomplete="off" role="combobox" aria-autocomplete="list" ` +
    `aria-expanded="${open ? "true" : "false"}" aria-controls="rate-${field}-list">` +
    `<div data-rate-list="${field}"${open ? "" : " hidden"}>${open ? listHtml : ""}</div>` +
    "</div></div>"
  );
}

function dateFields(model: RangeViewModel): string {
  const errEnd = model.error === "end";
  const errOrder = model.error === "order";
  return (
    '<div class="dates">' +
    `<div class="field${errOrder ? " is-error" : ""}"><span>Data początkowa</span>` +
    `<input type="date" data-filter="from" value="${escapeHtml(model.from)}"${model.noFrom ? " disabled" : ""} ` +
    `aria-invalid="${errOrder ? "true" : "false"}">` +
    (errOrder ? `<span class="err">${RANGE_ERROR.order}</span>` : "") +
    "</div>" +
    `<label class="field${errEnd || errOrder ? " is-error" : ""}"><span>Data końcowa</span>` +
    `<input type="date" data-filter="to" value="${escapeHtml(model.to)}" ` +
    `aria-invalid="${errEnd || errOrder ? "true" : "false"}">` +
    (errEnd ? `<span class="err">${RANGE_ERROR.end}</span>` : "") +
    "</label>" +
    `<label class="checkline"><input type="checkbox" data-toggle="nofrom"${model.noFrom ? " checked" : ""}> ` +
    "bez daty początkowej</label></div>"
  );
}

function ratesButton(): string {
  return '<button type="button" class="btn-ghost" data-action="rates">Baza stawek</button>';
}

function renderRangeScreen(model: RangeViewModel): string {
  const note = model.webappMissing
    ? '<p class="callout">Brak adresu Web App. Dopisz ?webapp= do adresu tej strony.</p>'
    : "";
  const status = model.status ? `<p class="err">${escapeHtml(model.status)}</p>` : "";
  return (
    '<div class="setup" data-screen="range"><div class="setup-card">' +
    brand(model.mode) +
    "<h2>Zakres rozliczenia</h2>" +
    '<p class="setup-lead">Ustal, czego dotyczy to rozliczenie. Pozycje pojawią się na następnym ekranie.</p>' +
    renderModes(model.mode) +
    '<div class="filters setup-fields">' +
    contractorField(model) +
    dateFields(model) +
    "</div>" +
    '<button type="button" class="btn-teal" data-action="search">Szukaj</button>' +
    status +
    note +
    '<div class="setup-foot">' +
    '<button type="button" class="btn-ghost" data-action="stats">Statystyki</button>' +
    ratesButton() +
    "</div></div></div>"
  );
}

function renderStatementScreen(model: RangeViewModel): string {
  const label = model.applied ? rangeLabel(model.applied) : "";
  return (
    '<div class="statement" data-screen="statement"><div class="top">' +
    brand(model.mode) +
    `<div class="range"><span>${escapeHtml(modeLabel(model.mode))}</span><strong>${escapeHtml(label)}</strong></div>` +
    '<button type="button" class="btn-ghost" data-action="back">Zmień zakres</button>' +
    ratesButton() +
    "</div>" +
    renderStatement(model.statement, model.status) +
    "</div>"
  );
}

export function renderRatesDialog(model: RangeViewModel): string {
  const messageClass = model.ratesMessageOk ? "note" : "err";
  return (
    '<div class="modal" data-window="rates">' +
    '<div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rates-title">' +
    '<h2 id="rates-title">Baza stawek</h2>' +
    rateCombo(
      "Sklep",
      "shop",
      model.ratesShopQuery,
      model.ratesShopOpen,
      "Nazwa sklepu lub adres",
      renderRateShopList(model),
    ) +
    rateCombo(
      "Podwykonawca",
      "contractor",
      model.ratesContractorQuery,
      model.ratesContractorOpen,
      "— wybierz podwykonawcę —",
      renderRateContractorList(model),
    ) +
    '<label class="field"><span>Kwota za podjazd</span>' +
    `<input type="text" inputmode="decimal" data-rate="pickup" data-keep="pickup" autocomplete="off" value="${escapeHtml(model.ratesPickup)}"></label>` +
    '<label class="field"><span>Kwota za worek</span>' +
    `<input type="text" inputmode="decimal" data-rate="bag" data-keep="bag" autocomplete="off" value="${escapeHtml(model.ratesBag)}"></label>` +
    '<label class="field"><span>Od kiedy obowiązuje</span>' +
    `<input type="date" data-rate="from" data-keep="from" value="${escapeHtml(model.ratesFrom)}">` +
    '<span class="note">Puste znaczy od zawsze.</span></label>' +
    `<p data-rates-message class="${messageClass}"${model.ratesMessage ? "" : " hidden"}>${escapeHtml(model.ratesMessage)}</p>` +
    '<div class="modal-actions">' +
    '<button type="button" class="btn-ghost" data-action="close-rates">Zamknij</button>' +
    '<button type="button" class="btn-teal" data-action="save-rates">Zapisz stawkę</button>' +
    "</div></div></div>"
  );
}

function renderLoading(message: string, unicorn: boolean): string {
  const mark = unicorn
    ? '<img class="uni" src="jednorozec-deba.gif" alt="Jednorożec staje dęba i rusza przednimi łapkami">'
    : '<img class="pulse" src="logo.png" alt="" width="64" height="64">';
  return (
    '<div class="overlay" role="status" aria-live="polite" aria-busy="true"><div class="overlay-panel">' +
    mark +
    `<div class="msg">${escapeHtml(message)}</div></div></div>`
  );
}

export function renderApp(model: RangeViewModel): string {
  const main =
    model.screen === "statement"
      ? renderStatementScreen(model)
      : model.screen === "stats"
        ? renderStatsScreen(model.stats)
        : renderRangeScreen(model);
  const dialog = model.ratesOpen ? renderRatesDialog(model) : "";
  const loading = model.loading ? renderLoading(model.loadMessage, model.loadKind === "unicorn") : "";
  return main + dialog + loading;
}

/** Domyślny stan stats w modelu aplikacji (zegar = dziś lokalnie). */
export function emptyStats(today: CalendarDate): StatsViewModel {
  return defaultStatsView(today);
}
