import { describe, expect, it } from "vitest";
import { defaultLedgerView, renderLedgerScreen } from "./ledgerView.js";
import type { PeriodInvoice } from "./stats.js";

function invoice(over: Partial<PeriodInvoice> = {}): PeriodInvoice {
  return {
    invoice: "FV/1",
    contractor: "gpw",
    mode: "report",
    bagCount: 2,
    amount: 1_500,
    pickupDate: "10.09.2026",
    approvedDate: "01.09.2026",
    ...over,
  };
}

const today = { year: 2026, month: 9, day: 23 };

describe("renderLedgerScreen", () => {
  it("test_renderLedgerScreen_sorts_newest_approval_first_and_blanks_last", () => {
    const html = renderLedgerScreen(
      defaultLedgerView(today, {
        appliedFrom: "01.09.2026",
        appliedTo: "30.09.2026",
        invoices: [
          invoice({ invoice: "FV/stara", approvedDate: "" }),
          invoice({ invoice: "FV/nowa", approvedDate: "20.09.2026", pickupDate: "02.09.2026" }),
          invoice({ invoice: "FV/srodkowa", approvedDate: "05.09.2026" }),
        ],
      }),
    );
    const body = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(body.indexOf("FV/nowa")).toBeLessThan(body.indexOf("FV/srodkowa"));
    expect(body.indexOf("FV/srodkowa")).toBeLessThan(body.indexOf("FV/stara"));
    expect(html).toContain('data-action="invoice-preview"');
    expect(html).toContain('data-action="invoice-edit"');
    expect(html).toContain("Data zatwierdzenia");
    expect(html).not.toContain("Brak faktur w tym okresie.");
  });

  it("test_renderLedgerScreen_filters_number_and_mode_without_a_new_read", () => {
    const html = renderLedgerScreen(
      defaultLedgerView(today, {
        invoiceQuery: "9",
        mode: "schedule",
        invoices: [
          invoice({ invoice: "FV/9", mode: "schedule", contractor: "blue" }),
          invoice({ invoice: "FV/9", mode: "report" }),
          invoice({ invoice: "FV/1", mode: "schedule" }),
        ],
      }),
    );
    expect(html).toContain("FV/9");
    expect(html).toContain("blue");
    expect(html).not.toContain(">FV/1<");
    expect(html).toContain('data-action="ledger-mode" data-mode="schedule"');
    const scheduleChip = html.slice(html.indexOf('data-mode="schedule"') - 80, html.indexOf('data-mode="schedule"'));
    expect(scheduleChip).toContain("is-on");
  });

  it("test_renderLedgerScreen_empty_period_says_there_are_no_invoices", () => {
    const html = renderLedgerScreen(
      defaultLedgerView(today, {
        invoices: [],
        appliedFrom: "01.09.2026",
        appliedTo: "30.09.2026",
      }),
    );
    expect(html).toContain("Brak faktur w tym okresie.");
  });
});
