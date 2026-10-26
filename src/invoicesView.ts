import { escapeHtml } from "./html.js";
import { groupSettledInvoices, invoiceCountLabel, type SettledInvoiceRow } from "./invoices.js";
import { formatPln } from "./statement.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";

const INVOICE_DASH = '<span class="muted">—</span>';

export function renderInvoiceList(
  rows: readonly SettledInvoiceRow[],
  focus: string | null = null,
): string {
  const groups = groupSettledInvoices(rows);
  if (groups.length === 0) {
    return (
      '<div class="blank"><strong>Brak rozliczonych faktur.</strong>' +
      "<p>Ten podwykonawca nie ma rozliczonych odbiorów w podanym zakresie.</p></div>"
    );
  }
  const note =
    '<p class="note invoice-note">Podgląd. Kwoty są z arkusza. Tych pozycji nie da się tu zmienić ani cofnąć.</p>';
  return `<div class="invoice-body">${note}${groups.map((group) => renderGroup(group, focus)).join("")}</div>`;
}

function renderGroup(
  group: ReturnType<typeof groupSettledInvoices>[number],
  focus: string | null,
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
    "<th>Numer protokołu</th><th>Adres</th><th>Sklep</th><th>Data</th><th>Trasa</th>" +
    '<th class="num">Liczba worków</th><th class="num">Koszt odbioru</th><th class="num">Koszt na worek</th>' +
    `</tr></thead><tbody>${group.rows.map(renderRow).join("")}</tbody></table></div></section>`
  );
}

function renderRow(row: SettledInvoiceRow): string {
  return (
    "<tr>" +
    `<td>${text(row.transportNumber)}</td>` +
    `<td class="adres">${text(addressWithCommaAfterLocality(row.address))}</td>` +
    `<td>${text(row.shopName)}</td>` +
    `<td>${text(row.pickupDate)}</td>` +
    `<td>${text(row.routeName)}</td>` +
    `<td class="num">${row.bagCount == null ? INVOICE_DASH : escapeHtml(String(row.bagCount))}</td>` +
    `<td class="num">${money(row.receptionCost)}</td>` +
    `<td class="num">${money(row.costPerBag)}</td>` +
    "</tr>"
  );
}

function text(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? INVOICE_DASH : escapeHtml(trimmed);
}

function money(grosze: number | null): string {
  return grosze == null ? INVOICE_DASH : escapeHtml(formatPln(grosze));
}
