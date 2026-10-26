import { describe, expect, it } from "vitest";
import {
  groupSettledInvoices,
  invoiceCountLabel,
  invoiceFocusLabel,
  readSettledInvoices,
  rowsOfInvoice,
  type SettledInvoiceRow,
} from "./invoices.js";
import { renderFocusedInvoice, renderInvoiceList } from "./invoicesView.js";

function row(over: Partial<SettledInvoiceRow> = {}): SettledInvoiceRow {
  return {
    sheetName: "Arkusz1",
    sheetRow: 2,
    transportNumber: "10",
    address: "Ul. Sklepowa 1",
    shopName: "Sklep A",
    pickupDate: "15.09.2026",
    contractor: "GPW",
    bagCount: 3,
    routeName: "",
    invoice: "FV/1",
    receptionCost: 15000,
    costPerBag: 5000,
    invoiceComment: "",
    ...over,
  };
}

describe("groupSettledInvoices", () => {
  it("test_groupSettledInvoices_groups_by_number_sums_cost_and_puts_blank_last", () => {
    const groups = groupSettledInvoices([
      row({ sheetRow: 4, transportNumber: "12", invoice: "", pickupDate: "18.09.2026", receptionCost: 1000 }),
      row({ sheetRow: 5, transportNumber: "20", invoice: "FV/10", pickupDate: "16.09.2026", receptionCost: 2000 }),
      row({ sheetRow: 3, transportNumber: "11", invoice: "FV/2", pickupDate: "12.09.2026", receptionCost: null }),
      row({ sheetRow: 2, transportNumber: "10", invoice: " FV/2 ", pickupDate: "20.09.2026", receptionCost: 4000 }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(["FV/2", "FV/10", "bez numeru"]);
    expect(groups[0].rows.map((item) => item.transportNumber)).toEqual(["11", "10"]);
    expect(groups[0].total).toBe(4000);
    expect(groups[2].total).toBe(1000);
    expect(invoiceCountLabel(1)).toBe("1 pozycja");
    expect(invoiceCountLabel(3)).toBe("3 pozycje");
    expect(invoiceCountLabel(5)).toBe("5 pozycji");
  });

  it("test_groupSettledInvoices_blank_costs_leave_total_empty", () => {
    const groups = groupSettledInvoices([row({ receptionCost: null })]);
    expect(groups[0].total).toBeNull();
  });
});

describe("readSettledInvoices", () => {
  it("test_readSettledInvoices_keeps_invoice_and_sheet_cost", () => {
    const read = readSettledInvoices({
      ok: true,
      rows: [row({ invoice: " FV/9 " })],
    });
    expect(read).toEqual({ ok: true, rows: [row({ invoice: "FV/9" })] });
  });

  it("test_readSettledInvoices_rejects_bad_payload", () => {
    expect(readSettledInvoices({ ok: false, error: "dataDo required" })).toEqual({
      ok: false,
      error: "dataDo required",
    });
    expect(readSettledInvoices({ ok: true }).ok).toBe(false);
    expect(readSettledInvoices({ ok: true, rows: [{ sheetRow: 2 }] }).ok).toBe(false);
  });
});

describe("renderInvoiceList", () => {
  it("test_renderInvoiceList_is_readonly_and_groups_invoices", () => {
    const html = renderInvoiceList([
      row(),
      row({
        sheetRow: 3,
        transportNumber: "11",
        invoice: "FV/2",
        shopName: "Sklep <B>",
        receptionCost: 2000,
        costPerBag: null,
        routeName: "trasa-1",
        bagCount: null,
        invoiceComment: "folia",
      }),
    ]);
    expect(html).toContain("FV/1");
    expect(html).toContain("FV/2");
    expect(html).toContain("150,00");
    expect(html).toContain("Sklep &lt;B&gt;");
    expect(html).toContain("trasa-1");
    expect(html).toContain("Podgląd.");
    expect(html).toContain("nie da się tu zmienić ani cofnąć");
    expect(html).toContain('data-comment-for="row"');
    expect(html).toContain("folia");
    expect(html).toContain('data-invoice-pick="1"');
    expect(html).toContain("Komentarz dla zaznaczonych pozycji");
    expect(html).not.toContain("data-action=\"approve\"");
    expect(html).not.toContain('data-edit=');
    expect(html).not.toContain("Zatwierdź");
  });

  it("test_renderInvoiceList_empty_range_has_no_table", () => {
    const html = renderInvoiceList([]);
    expect(html).toContain("Brak rozliczonych faktur.");
    expect(html).not.toContain("<table>");
  });

  it("test_renderInvoiceList_focus_shows_only_that_invoice", () => {
    const html = renderInvoiceList(
      [
        row(),
        row({
          sheetRow: 3,
          transportNumber: "11",
          invoice: "FV/2",
          shopName: "Sklep Obcy",
        }),
      ],
      "FV/1",
    );
    expect(html).toContain("FV/1");
    expect(html).toContain("Sklep A");
    expect(html).toContain("is-focus");
    expect(html).not.toContain("FV/2");
    expect(html).not.toContain("Sklep Obcy");
  });

  it("test_renderInvoiceList_missing_focus_hides_other_invoices", () => {
    const html = renderInvoiceList([row({ invoice: "FV/2", shopName: "Sklep Obcy" })], "FV/9");
    expect(html).toContain("Brak pozycji tej faktury.");
    expect(html).toContain("FV/9");
    expect(html).not.toContain("Sklep Obcy");
    expect(html).not.toContain("<table>");
  });
});

describe("rowsOfInvoice", () => {
  it("test_rowsOfInvoice_keeps_one_number_after_trim", () => {
    const rows = rowsOfInvoice(
      [row(), row({ sheetRow: 3, invoice: " FV/2 ", transportNumber: "11" })],
      "FV/2",
    );
    expect(rows.map((item) => item.transportNumber)).toEqual(["11"]);
    expect(invoiceFocusLabel("")).toBe("bez numeru");
    expect(invoiceFocusLabel(" FV/2 ")).toBe("FV/2");
  });
});

describe("renderFocusedInvoice", () => {
  it("test_renderFocusedInvoice_lists_only_the_chosen_number", () => {
    const html = renderFocusedInvoice(
      [row(), row({ sheetRow: 3, invoice: "FV/2", shopName: "Sklep Obcy", transportNumber: "11" })],
      "FV/1",
    );
    expect(html).toContain("FV/1");
    expect(html).toContain("Sklep A");
    expect(html).toContain("150,00");
    expect(html).not.toContain("Sklep Obcy");
    expect(html).not.toContain("data-invoice-pick");
    expect(html).not.toContain("data-comment-for");
  });

  it("test_renderFocusedInvoice_notice_replaces_the_table", () => {
    const html = renderFocusedInvoice([row()], "FV/1", "Odczyt pozycji tej faktury nie doszedł.");
    expect(html).toContain("Odczyt pozycji tej faktury nie doszedł.");
    expect(html).not.toContain("<table>");
    expect(html).not.toContain("Sklep A");
  });
});
