import { rowKey } from "./engine.js";
import { escapeHtml } from "./html.js";
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
import { groupSettledInvoices, invoiceCountLabel, type SettledInvoiceRow } from "./invoices.js";
import { formatPln } from "./statement.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";

const INVOICE_DASH = '<span class="muted">—</span>';

export function renderInvoiceList(
  rows: readonly SettledInvoiceRow[],
  focus: string | null = null,
  comment: InvoiceCommentDraft = emptyInvoiceComment(),
): string {
  const groups = groupSettledInvoices(rows);
  if (groups.length === 0) {
    return (
      '<div class="blank"><strong>Brak rozliczonych faktur.</strong>' +
      "<p>Ten podwykonawca nie ma rozliczonych odbiorów w podanym zakresie.</p></div>"
    );
  }
  const note =
    '<p class="note invoice-note">Podgląd. Kwoty są z arkusza. Tych pozycji nie da się tu zmienić ani cofnąć. ' +
    "Komentarz przy pozycji zmieniasz w jej polu. Wspólny tekst dla kilku pozycji wpisujesz na dole.</p>";
  const notice = comment.notice
    ? `<p class="notice" role="status" data-out="invoice-comment-notice">${escapeHtml(comment.notice)}</p>`
    : "";
  return (
    `<div class="invoice-body">${note}${notice}${groups.map((group) => renderGroup(group, focus, comment)).join("")}</div>` +
    invoiceComposer(rows, comment)
  );
}

function renderGroup(
  group: ReturnType<typeof groupSettledInvoices>[number],
  focus: string | null,
  comment: InvoiceCommentDraft,
): string {
  const total = group.total == null ? INVOICE_DASH : escapeHtml(formatPln(group.total));
  const on = focus !== null && group.invoice === focus;
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
