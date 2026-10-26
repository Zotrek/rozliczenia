import { describe, expect, it } from "vitest";
import { emptyInvoiceEdit, invoiceEditBody, invoiceEditFace } from "./invoiceEdit.js";
import { renderFocusedInvoice } from "./invoicesView.js";
import type { SettledInvoiceRow } from "./invoices.js";

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
    routeRate: null,
    pickupRate: 10_000,
    bagRate: 500,
    invoice: "FV/1",
    receptionCost: 11_500,
    costPerBag: 3_833,
    invoiceComment: "",
    ...over,
  };
}

describe("invoiceEditBody", () => {
  it("test_invoiceEditBody_clean_draft_does_not_save", () => {
    const face = invoiceEditFace([row()], emptyInvoiceEdit());
    expect(face.dirty).toBe(false);
    expect(face.invalid).toBe(false);
    expect(face.total).toBe(11_500);
    expect(invoiceEditBody([row()], emptyInvoiceEdit(), "FV/1")).toEqual({ ok: true, unchanged: true });
  });

  it("test_invoiceEditBody_bag_change_recalculates_plain_cost_and_waits_for_save", () => {
    const draft = { ...emptyInvoiceEdit(), bags: { "Arkusz1\t2\t10": "4" } };
    const face = invoiceEditFace([row()], draft);
    expect(face.dirty).toBe(true);
    expect(face.lines["Arkusz1\t2\t10"].receptionCost).toBe(12_000);
    expect(face.lines["Arkusz1\t2\t10"].costPerBag).toBe(3_000);
    expect(face.total).toBe(12_000);
    const built = invoiceEditBody([row()], draft, "FV/1");
    expect(built).toEqual({
      ok: true,
      unchanged: false,
      body: {
        action: "patchInvoiceEdit",
        numerFaktury: "FV/1",
        wiersze: [
          {
            sheetName: "Arkusz1",
            sheetRow: 2,
            transportNumber: "10",
            iloscWorkow: 4,
            stawkaPodjazdu: "100.00",
            stawkaWorka: "5.00",
            koszt: 12_000,
          },
        ],
      },
    });
  });

  it("test_invoiceEditBody_bad_bag_blocks_save", () => {
    const draft = { ...emptyInvoiceEdit(), bags: { "Arkusz1\t2\t10": "-1" } };
    const face = invoiceEditFace([row()], draft);
    expect(face.invalid).toBe(true);
    expect(face.dirty).toBe(false);
    expect(face.lines["Arkusz1\t2\t10"].receptionCost).toBe(11_500);
    expect(invoiceEditBody([row()], draft, "FV/1")).toEqual({
      ok: false,
      error: "Liczba worków jest niepoprawna.",
    });
  });

  it("test_invoiceEditBody_detach_drops_shop_and_resplits_route_share", () => {
    const shops = [
      row({
        transportNumber: "10",
        routeName: "Trasa",
        routeRate: 10_000,
        pickupRate: 0,
        bagRate: 0,
        bagCount: 1,
        receptionCost: 5_000,
        costPerBag: 5_000,
      }),
      row({
        sheetRow: 3,
        transportNumber: "11",
        address: "Inna 2",
        shopName: "Sklep B",
        routeName: "Trasa",
        routeRate: 10_000,
        pickupRate: 0,
        bagRate: 0,
        bagCount: 1,
        receptionCost: 5_000,
        costPerBag: 5_000,
      }),
    ];
    const draft = { ...emptyInvoiceEdit(), detached: { "Arkusz1\t2\t10": true as const } };
    const face = invoiceEditFace(shops, draft);
    expect(face.leaving).toBe(1);
    expect(face.total).toBe(10_000);
    expect(face.lines["Arkusz1\t3\t11"].receptionCost).toBe(10_000);
    const built = invoiceEditBody(shops, draft, "FV/1", "schedule");
    expect(built.ok).toBe(true);
    if (!built.ok || built.unchanged) {
      throw new Error("oczekiwany zapis");
    }
    expect(built.body.tryb).toBe("harmonogram");
    expect(built.body.wiersze).toEqual([
      {
        sheetName: "Arkusz1",
        sheetRow: 2,
        transportNumber: "10",
        odepnij: true,
      },
      {
        sheetName: "Arkusz1",
        sheetRow: 3,
        transportNumber: "11",
        iloscWorkow: 1,
        stawkaPodjazdu: "0.00",
        stawkaWorka: "0.00",
        stawkaTrasy: "100.00",
        koszt: 10_000,
      },
    ]);
  });

  it("test_invoiceEditBody_route_rate_updates_every_shop_of_that_route", () => {
    const shops = [
      row({
        routeName: "Trasa",
        routeRate: 10_000,
        bagRate: 0,
        bagCount: 0,
        receptionCost: 5_000,
        costPerBag: 5_000,
      }),
      row({
        sheetRow: 3,
        transportNumber: "11",
        shopName: "Sklep B",
        routeName: "Trasa",
        routeRate: 10_000,
        bagRate: 0,
        bagCount: 0,
        receptionCost: 5_000,
        costPerBag: 5_000,
      }),
    ];
    const draft = { ...emptyInvoiceEdit(), routeRate: { Trasa: "150" } };
    const face = invoiceEditFace(shops, draft);
    expect(face.lines["Arkusz1\t2\t10"].receptionCost).toBe(7_500);
    expect(face.lines["Arkusz1\t3\t11"].receptionCost).toBe(7_500);
    expect(face.total).toBe(15_000);
    const built = invoiceEditBody(shops, draft, " FV/1 ");
    expect(built.ok).toBe(true);
    if (!built.ok || built.unchanged) {
      throw new Error("oczekiwany zapis");
    }
    const rows = built.body.wiersze as { stawkaTrasy: string; koszt: number }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((item) => item.stawkaTrasy === "150.00" && item.koszt === 7_500)).toBe(true);
    expect(built.body.numerFaktury).toBe("FV/1");
  });
});

describe("renderFocusedInvoice", () => {
  it("test_renderFocusedInvoice_edits_bags_rates_and_saves_on_a_button", () => {
    const html = renderFocusedInvoice([row()], "FV/1", "", emptyInvoiceEdit());
    expect(html).toContain('data-edit="invoice-bags"');
    expect(html).toContain('data-edit="invoice-pickup"');
    expect(html).toContain('data-edit="invoice-bag-rate"');
    expect(html).toContain('data-action="invoice-detach"');
    expect(html).toContain("odepnij sklep");
    expect(html).toContain('data-action="save-invoice-edit" disabled');
    expect(html).toContain("Zapisz zmiany");
    expect(html).not.toContain('data-edit="invoice-route-rate"');
    const dirty = renderFocusedInvoice(
      [row()],
      "FV/1",
      "",
      { ...emptyInvoiceEdit(), bags: { "Arkusz1\t2\t10": "4" } },
    );
    expect(dirty).toContain('data-action="save-invoice-edit"');
    expect(dirty).not.toContain('data-action="save-invoice-edit" disabled');
    expect(dirty).toContain("120,00");
    const detached = renderFocusedInvoice(
      [row({ routeName: "Trasa", routeRate: 10_000 })],
      "FV/1",
      "",
      { ...emptyInvoiceEdit(), detached: { "Arkusz1\t2\t10": true } },
    );
    expect(detached).toContain("przywróć");
    expect(detached).toContain("do odpięcia");
    expect(detached).toContain('data-edit="invoice-route-rate"');
    expect(detached).toContain("disabled");
  });
});
