import { escapeHtml } from "./html.js";
import {
  RANGE_ERROR,
  foldPl,
  matchingContractors,
  rangeLabel,
  selectedContractor,
  type ContractorListItem,
  type RangeError,
  type ScreenId,
  type StartedSearch,
} from "./range.js";
import { rateContractorNames } from "./rateWindow.js";
import type { StatementScreen } from "./statement.js";
import { renderStatement } from "./statementView.js";

export interface RangeViewModel {
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
  /** Kolumna Adres sklepu rejestru. Nie pinezki. */
  addresses: readonly string[];
  ratesShop: string;
  ratesContractor: string;
  ratesPickup: string;
  ratesBag: string;
  ratesFrom: string;
  ratesMessage: string;
  ratesMessageOk: boolean;
}


function brand(): string {
  return (
    '<div class="brand"><img src="logo.png" alt="" width="36" height="36">' +
    "<div><strong>Rozliczenia</strong><em>Na zgłoszenie</em></div></div>"
  );
}

export function renderModes(): string {
  return (
    '<div class="modes" role="group" aria-label="Tryb">' +
    '<label class="mode is-on"><input type="checkbox" id="mode-na" checked> Na zgłoszenie</label>' +
    '<label class="mode is-off" title="W tej wersji niedostępne">' +
    '<input type="checkbox" id="mode-h" disabled> Harmonogram</label></div>'
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
          `<li><button type="button" data-action="pick-contractor" data-nazwa="${escapeHtml(item.nazwa)}">` +
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
    `<input type="text" data-filter="contractor" value="${escapeHtml(model.contractorQuery)}" ` +
    'placeholder="Nazwa lub dane do Worda" autocomplete="off" role="combobox" aria-autocomplete="list" ' +
    `aria-expanded="${model.contractorOpen ? "true" : "false"}" aria-controls="contractor-list">` +
    `<div data-picker-list${model.contractorOpen ? "" : " hidden"}>${model.contractorOpen ? renderContractorList(model) : ""}</div>` +
    `<span class="note" data-contractor-note${picked && !model.contractorOpen ? "" : " hidden"}>${note}</span>` +
    (err ? `<span class="err" data-contractor-error>${RANGE_ERROR.contractor}</span>` : "") +
    "</div>"
  );
}

function dateFields(model: RangeViewModel): string {
  const errEnd = model.error === "end";
  const errOrder = model.error === "order";
  return (
    `<div class="field${errOrder ? " is-error" : ""}"><span>Data początkowa</span>` +
    `<input type="date" data-filter="from" value="${escapeHtml(model.from)}"${model.noFrom ? " disabled" : ""} ` +
    `aria-invalid="${errOrder ? "true" : "false"}">` +
    (errOrder ? `<span class="err">${RANGE_ERROR.order}</span>` : "") +
    `<label class="checkline"><input type="checkbox" data-toggle="nofrom"${model.noFrom ? " checked" : ""}> ` +
    "bez daty początkowej</label></div>" +
    `<label class="field${errEnd || errOrder ? " is-error" : ""}"><span>Data końcowa</span>` +
    `<input type="date" data-filter="to" value="${escapeHtml(model.to)}" ` +
    `aria-invalid="${errEnd || errOrder ? "true" : "false"}">` +
    (errEnd ? `<span class="err">${RANGE_ERROR.end}</span>` : "") +
    "</label>"
  );
}

function ratesButton(): string {
  return '<button type="button" class="btn-ghost" data-action="rates">Baza stawek</button>';
}

function renderRangeScreen(model: RangeViewModel): string {
  const note = model.webappMissing
    ? '<p class="note">Brak adresu Web App. Dopisz ?webapp= do adresu tej strony.</p>'
    : "";
  const status = model.status ? `<p class="err">${escapeHtml(model.status)}</p>` : "";
  return (
    '<div class="setup" data-screen="range"><div class="setup-card">' +
    brand() +
    "<h2>Zakres rozliczenia</h2>" +
    '<p class="note">Ustal, czego dotyczy to rozliczenie. Pozycje pojawią się na następnym ekranie.</p>' +
    renderModes() +
    '<div class="filters setup-fields">' +
    contractorField(model) +
    dateFields(model) +
    "</div>" +
    '<button type="button" class="btn-teal" data-action="search">Szukaj</button>' +
    status +
    note +
    '<div class="setup-foot">' +
    ratesButton() +
    "</div></div></div>"
  );
}

function renderStatementScreen(model: RangeViewModel): string {
  const label = model.applied ? rangeLabel(model.applied) : "";
  return (
    '<div class="statement" data-screen="statement"><div class="top">' +
    brand() +
    `<div class="range"><span>Na zgłoszenie</span><strong>${escapeHtml(label)}</strong></div>` +
    '<button type="button" class="btn-ghost" data-action="back">Zmień zakres</button>' +
    ratesButton() +
    "</div>" +
    renderStatement(model.statement, model.status) +
    "</div>"
  );
}

function selectOptions(values: readonly string[], selected: string, placeholder: string): string {
  const head = `<option value="">${escapeHtml(placeholder)}</option>`;
  const rest = values
    .map((value) => {
      const on = value === selected ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${on}>${escapeHtml(value)}</option>`;
    })
    .join("");
  return head + rest;
}

export function renderRatesDialog(model: RangeViewModel): string {
  const message = model.ratesMessage
    ? `<p class="${model.ratesMessageOk ? "note" : "err"}">${escapeHtml(model.ratesMessage)}</p>`
    : "";
  return (
    '<div class="modal" data-window="rates">' +
    '<div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rates-title">' +
    '<h2 id="rates-title">Baza stawek</h2>' +
    '<p class="note">Zapis od razu, nie czeka na Zatwierdź. Nie zmienia Rozliczony, Numer faktury ani kolumn 16 i 17. Stawki trasy tu nie ma. Remis rozstrzyga się na zestawieniu, nie tutaj.</p>' +
    `<label class="field"><span>Sklep</span><select data-rate="shop">${selectOptions(model.addresses, model.ratesShop, "— wybierz adres —")}</select></label>` +
    `<label class="field"><span>Podwykonawca</span><select data-rate="contractor">${selectOptions(rateContractorNames(model.contractors), model.ratesContractor, "— wybierz podwykonawcę —")}</select></label>` +
    '<label class="field"><span>Kwota za podjazd</span>' +
    `<input type="text" inputmode="decimal" data-rate="pickup" data-keep="pickup" autocomplete="off" value="${escapeHtml(model.ratesPickup)}"></label>` +
    '<label class="field"><span>Kwota za worek</span>' +
    `<input type="text" inputmode="decimal" data-rate="bag" data-keep="bag" autocomplete="off" value="${escapeHtml(model.ratesBag)}"></label>` +
    '<label class="field"><span>Od kiedy obowiązuje</span>' +
    `<input type="text" data-rate="from" data-keep="from" autocomplete="off" placeholder="dd.mm.yyyy" value="${escapeHtml(model.ratesFrom)}">` +
    '<span class="note">Puste znaczy od zawsze.</span></label>' +
    '<p class="note">Adres z kolumny Adres sklepu rejestru. Podwykonawca to nazwa krótka z Listy podwykonawców. Nie pinezki mapy. Wpisu ręcznego nie ma.</p>' +
    message +
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
  const main = model.screen === "statement" ? renderStatementScreen(model) : renderRangeScreen(model);
  const dialog = model.ratesOpen ? renderRatesDialog(model) : "";
  const loading = model.loading ? renderLoading(model.loadMessage, model.loadKind === "unicorn") : "";
  return main + dialog + loading;
}
