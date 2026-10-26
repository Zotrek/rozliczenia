import { describe, expect, it } from "vitest";
import { groupSettledInvoices, invoiceCountLabel, readSettledInvoices, type SettledInvoiceRow } from "./invoices.js";
import { renderInvoiceList } from "./invoicesView.js";

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
});
