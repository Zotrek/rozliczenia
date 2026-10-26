import { rowKey } from "./engine.js";
import { escapeHtml } from "./html.js";
import {
  emptyInvoiceEdit,
  invoiceEditFace,
  type InvoiceEditDraft,
  type InvoiceEditLine,
} from "./invoiceEdit.js";
import {
  allPicked,
  applyButtonLabel,
  applyIsDisabled,
  chosenComments,
  commentsToOverwrite,
  emptyInvoiceComment,
  invoiceCommentTargets,
  invoiceSelectionSummary,
  overwriteHint,
  willOverwrite,
  type InvoiceCommentDraft,
} from "./invoiceComment.js";
import {
  groupSettledInvoices,
  invoiceCountLabel,
  invoiceFocusLabel,
  rowsOfInvoice,
  type SettledInvoiceRow,
} from "./invoices.js";
import { formatPln } from "./statement.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";

const INVOICE_DASH = '<span class="muted">—</span>';

export function renderInvoiceList(
  rows: readonly SettledInvoiceRow[],
  focus: string | null = null,
  comment: InvoiceCommentDraft = emptyInvoiceComment(),
): string {
  const visible = focus === null ? rows : rowsOfInvoice(rows, focus);
  const groups = groupSettledInvoices(visible);
  if (groups.length === 0) {
    return emptyInvoices(focus);
  }
  const note =
    '<p class="note invoice-note">Podgląd. Kwoty są z arkusza. Tych pozycji nie da się tu zmienić ani cofnąć. ' +
    "Komentarz przy pozycji zmieniasz w jej polu. Wspólny tekst dla kilku pozycji wpisujesz na dole.</p>";
  const notice = comment.notice
    ? `<p class="notice" role="status" data-out="invoice-comment-notice">${escapeHtml(comment.notice)}</p>`
    : "";
  return (
    `<div class="invoice-body">${note}${notice}${groups.map((group) => renderGroup(group, focus, comment)).join("")}</div>` +
    invoiceComposer(visible, comment)
  );
}

/** Jedna faktura na zestawieniu: pozycje już rozliczone, bez komentarza i bez zaznaczania. */
export function renderFocusedInvoice(
  rows: readonly SettledInvoiceRow[],
  focus: string,
  notice = "",
  edit: InvoiceEditDraft = emptyInvoiceEdit(),
): string {
  const label = invoiceFocusLabel(focus);
  const key = focus.trim();
  if (notice !== "") {
    return (
      `<section class="invoice-card is-focus" data-invoice="${escapeHtml(key)}">` +
      `<header class="invoice-head"><strong>${escapeHtml(label)}</strong></header>` +
      `<p class="note">${escapeHtml(notice)}</p></section>`
    );
  }
  const groups = groupSettledInvoices(rowsOfInvoice(rows, focus));
  if (groups.length === 0) {
    return (
      `<section class="invoice-card is-focus" data-invoice="${escapeHtml(key)}">` +
      `<header class="invoice-head"><strong>${escapeHtml(label)}</strong><span>brak pozycji</span></header>` +
      "<p class=\"note\">W tym zakresie nie ma rozliczonych odbiorów tej faktury.</p></section>"
    );
  }
  const group = groups[0];
  const face = invoiceEditFace(group.rows, edit);
  const total = face.total == null ? INVOICE_DASH : escapeHtml(formatPln(face.total));
  const leaving = face.leaving > 0 ? ` · ${face.leaving} do odpięcia` : "";
  const status = edit.status || face.error;
  const statusHtml = status
    ? `<p class="err" data-out="invoice-edit-status">${escapeHtml(status)}</p>`
    : "";
  const noticeHtml = edit.notice
    ? `<p class="notice" role="status">${escapeHtml(edit.notice)}</p>`
    : "";
  const saveDisabled = !face.dirty || face.invalid ? " disabled" : "";
  return (
    `<section class="invoice-card is-focus" data-invoice="${escapeHtml(group.invoice)}">` +
    '<header class="invoice-head">' +
    `<strong>${escapeHtml(group.label)}</strong>` +
    `<span>${escapeHtml(invoiceCountLabel(group.rows.length - face.leaving))}${escapeHtml(leaving)} · ${total}</span>` +
    "</header>" +
    '<div class="table-wrap"><table><thead><tr>' +
    "<th>Numer protokołu</th><th>Adres</th><th>Sklep</th><th>Data</th><th>Trasa</th>" +
    '<th class="num">Liczba worków</th><th class="num">Stawka podjazdu</th><th class="num">Stawka za worek</th>' +
    '<th class="num">Stawka trasy</th><th class="num">Koszt odbioru</th><th class="num">Koszt na worek</th><th></th>' +
    `</tr></thead><tbody>${group.rows.map((row) => focusedLine(row, face.lines[rowKey(row.sheetRow, row.transportNumber, row.sheetName)])).join("")}</tbody></table></div>` +
    '<footer class="invoice-save">' +
    '<p class="note">Odepnij sklep zdejmuje go z faktury. Worki i stawki zostają, sklep wraca do nierozliczonych. ' +
    "Na trasie koszt bierze udział w stawce trasy. Do arkusza schodzi dopiero po Zapisz zmiany.</p>" +
    statusHtml +
    noticeHtml +
    `<button type="button" class="btn-teal" data-action="save-invoice-edit"${saveDisabled}>Zapisz zmiany</button>` +
    "</footer></section>"
  );
}

function emptyInvoices(focus: string | null): string {
  if (focus !== null) {
    const label = invoiceFocusLabel(focus);
    const detail =
      focus.trim() === ""
        ? "W tym zakresie nie ma rozliczonych odbiorów bez numeru faktury."
        : `W tym zakresie nie ma rozliczonych odbiorów z numerem ${label}.`;
    return (
      '<div class="blank"><strong>Brak pozycji tej faktury.</strong>' +
      `<p>${escapeHtml(detail)}</p></div>`
    );
  }
  return (
    '<div class="blank"><strong>Brak rozliczonych faktur.</strong>' +
    "<p>Ten podwykonawca nie ma rozliczonych odbiorów w podanym zakresie.</p></div>"
  );
}

function focusedLine(row: SettledInvoiceRow, line: InvoiceEditLine | undefined): string {
  const shown = line ?? {
    bagText: row.bagCount == null ? "" : String(row.bagCount),
    pickupText: "",
    bagRateText: "",
    routeText: "",
    bagBad: false,
    pickupBad: false,
    bagRateBad: false,
    routeBad: false,
    detached: false,
    receptionCost: row.receptionCost,
    costPerBag: row.costPerBag,
  };
  const label = row.shopName.trim() === "" ? row.address : row.shopName;
  const off = shown.detached ? " disabled" : "";
  const classes = [row.routeName.trim() === "" ? "" : "is-child", shown.detached ? "is-detached" : ""].filter(Boolean);
  return (
    `<tr${classes.length ? ` class="${classes.join(" ")}"` : ""}>` +
    `<td>${text(row.transportNumber)}</td>` +
    `<td class="adres">${text(addressWithCommaAfterLocality(row.address))}</td>` +
    `<td>${text(row.shopName)}</td>` +
    `<td>${text(row.pickupDate)}</td>` +
    `<td>${text(row.routeName)}</td>` +
    `<td class="num">${rateField(row, "invoice-bags", "bags", shown.bagText, shown.bagBad, off, `Liczba worków, ${label}`)}</td>` +
    `<td class="num">${rateField(row, "invoice-pickup", "pickup", shown.pickupText, shown.pickupBad, off, `Stawka podjazdu, ${label}`)}</td>` +
    `<td class="num">${rateField(row, "invoice-bag-rate", "bag", shown.bagRateText, shown.bagRateBad, off, `Stawka za worek, ${label}`)}</td>` +
    `<td class="num">${row.routeName.trim() === "" ? INVOICE_DASH : rateField(row, "invoice-route-rate", "route", shown.routeText, shown.routeBad, off, `Stawka trasy ${row.routeName}`, row.routeName)}</td>` +
    `<td class="num">${money(shown.receptionCost)}</td>` +
    `<td class="num">${money(shown.costPerBag)}</td>` +
    `<td>${detachControl(row, shown.detached, label)}</td>` +
    "</tr>"
  );
}

function rateField(
  row: SettledInvoiceRow,
  edit: string,
  keep: string,
  value: string,
  bad: boolean,
  off: string,
  label: string,
  routeName = "",
): string {
  const route = routeName === "" ? "" : ` data-route="${escapeHtml(routeName)}"`;
  const mode = edit === "invoice-bags" ? "numeric" : "decimal";
  return (
    `<input type="text" inputmode="${mode}" data-edit="${edit}" data-keep="${escapeHtml(invoiceKeep(keep, row))}" ` +
    `${ref(row)}${route} value="${escapeHtml(value)}"${bad ? ' class="is-bad"' : ""}${off} ` +
    `title="Zapis po Zapisz zmiany." aria-label="${escapeHtml(label)}" autocomplete="off">`
  );
}

function detachControl(row: SettledInvoiceRow, detached: boolean, label: string): string {
  const title = detached
    ? "Sklep zostaje na fakturze. Zapis nadal po Zapisz zmiany."
    : "Sklep schodzi z tej faktury po Zapisz zmiany. Worki i stawki zostają w arkuszu.";
  return (
    `<button type="button" class="btn-detach" data-action="invoice-detach" ${ref(row)} ` +
    `title="${escapeHtml(title)}" aria-label="${escapeHtml(`${detached ? "Przywróć" : "Odepnij"} ${label}`)}">` +
    `${detached ? "przywróć" : "odepnij sklep"}</button>`
  );
}

function invoiceKeep(kind: string, row: SettledInvoiceRow): string {
  return `inv-${kind}-${row.sheetRow}-${encodeURIComponent(row.transportNumber)}-${encodeURIComponent(row.sheetName)}`;
}

function renderGroup(
  group: ReturnType<typeof groupSettledInvoices>[number],
  focus: string | null,
  comment: InvoiceCommentDraft,
): string {
  const total = group.total == null ? INVOICE_DASH : escapeHtml(formatPln(group.total));
  const on = focus !== null && group.invoice === focus.trim();
  return (
    `<section class="invoice-card${on ? " is-focus" : ""}" data-invoice="${escapeHtml(group.invoice)}">` +
    '<header class="invoice-head">' +
    `<strong>${escapeHtml(group.label)}</strong>` +
    `<span>${escapeHtml(invoiceCountLabel(group.rows.length))} · ${total}</span>` +
    "</header>" +
    '<div class="table-wrap"><table><thead><tr>' +
    '<th class="c">Zaznacz</th>' +
    "<th>Numer protokołu</th><th>Adres</th><th>Sklep</th><th>Data</th><th>Trasa</th>" +
    '<th class="num">Liczba worków</th><th class="num">Koszt odbioru</th><th class="num">Koszt na worek</th>' +
    '<th class="comment-col wrap">Komentarz do faktury</th>' +
    `</tr></thead><tbody>${group.rows.map((row) => renderRow(row, comment)).join("")}</tbody></table></div></section>`
  );
}

function renderRow(row: SettledInvoiceRow, comment: InvoiceCommentDraft): string {
  const key = rowKey(row.sheetRow, row.transportNumber, row.sheetName);
  const textValue = comment.comments[key] ?? "";
  const picked = comment.picks[key] === true;
  const overwrite = willOverwrite(textValue, picked, comment.draft);
  const classes = [
    row.routeName.trim() === "" ? "" : "is-child",
    overwrite ? "will-overwrite" : picked ? "is-picked" : "",
  ].filter(Boolean);
  const label = row.shopName.trim() === "" ? row.address : row.shopName;
  return (
    `<tr${classes.length ? ` class="${classes.join(" ")}"` : ""}>` +
    `<td class="c"><input type="checkbox" data-invoice-pick="1" ${ref(row)}${picked ? " checked" : ""} aria-label="${escapeHtml(`Zaznacz ${label} do wspólnego komentarza`)}"></td>` +
    `<td>${text(row.transportNumber)}</td>` +
    `<td class="adres">${text(addressWithCommaAfterLocality(row.address))}</td>` +
    `<td>${text(row.shopName)}</td>` +
    `<td>${text(row.pickupDate)}</td>` +
    `<td>${text(row.routeName)}</td>` +
    `<td class="num">${row.bagCount == null ? INVOICE_DASH : escapeHtml(String(row.bagCount))}</td>` +
    `<td class="num">${money(row.receptionCost)}</td>` +
    `<td class="num">${money(row.costPerBag)}</td>` +
    `<td class="comment-col"><textarea class="comment-input" data-comment-for="row" ${ref(row)} rows="2" aria-label="${escapeHtml(`Komentarz do faktury, ${label}`)}">${escapeHtml(textValue)}</textarea></td>` +
    "</tr>"
  );
}

function invoiceComposer(rows: readonly SettledInvoiceRow[], comment: InvoiceCommentDraft): string {
  const targets = invoiceCommentTargets(rows, comment.comments);
  const chosen = chosenComments(targets, comment.picks);
  const hint = overwriteHint(commentsToOverwrite(chosen, comment.draft), comment.draft);
  const summary = invoiceSelectionSummary(chosen.length);
  const disabled = applyIsDisabled(comment.draft, chosen);
  return (
    '<footer class="composer" data-composer="invoice"><div class="composer-bar"><div class="composer-lead">' +
    "<h2>Komentarz dla zaznaczonych pozycji</h2>" +
    `<p class="selection-summary${chosen.length === 0 ? " muted" : ""}" data-out="invoice-comment-summary">${escapeHtml(summary)}</p></div>` +
    `<textarea data-draft="invoice-bulk" data-keep="invoice-comment" rows="2" placeholder="np. folia osobno, bez PET" aria-label="Komentarz dla zaznaczonych pozycji">${escapeHtml(comment.draft)}</textarea>` +
    `<button type="button" class="btn-teal" data-action="apply-invoice-comment"${disabled ? " disabled" : ""}>${escapeHtml(applyButtonLabel(comment.draft, chosen))}</button></div>` +
    '<div class="composer-actions">' +
    `<button type="button" class="text-btn" data-action="check-invoice-all">${allPicked(targets, comment.picks) ? "odznacz" : "zaznacz wszystkie"}</button></div>` +
    `<p class="note overwrite-hint" data-out="invoice-overwrite-hint"${hint ? "" : " hidden"}>${escapeHtml(hint)}</p>` +
    '<p class="note composer-foot">Na tym ekranie. Numer i kwoty bez zmian. Do rejestru jeszcze nie schodzi.</p></footer>'
  );
}

function ref(row: SettledInvoiceRow): string {
  return `data-sheet-name="${escapeHtml(row.sheetName)}" data-sheet-row="${row.sheetRow}" data-transport="${escapeHtml(row.transportNumber)}"`;
}

function text(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? INVOICE_DASH : escapeHtml(trimmed);
}

function money(grosze: number | null): string {
  return grosze == null ? INVOICE_DASH : escapeHtml(formatPln(grosze));
}
