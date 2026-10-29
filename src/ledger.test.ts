import { describe, expect, it } from "vitest";
import { filterLedgerInvoices } from "./ledger.js";
import type { PeriodInvoice } from "./stats.js";

function invoice(over: Partial<PeriodInvoice> = {}): PeriodInvoice {
  return {
    invoice: "FV/1",
    contractor: "gpw",
    mode: "report",
    bagCount: 1,
    amount: 100,
    pickupDate: "10.09.2026",
    approvedDate: "01.09.2026",
    ...over,
  };
}

describe("filterLedgerInvoices", () => {
  const rows = [
    invoice({ invoice: "FV/10", contractor: "blue" }),
    invoice({ invoice: "fv/2", mode: "schedule" }),
    invoice({ invoice: "FV/1" }),
  ];

  it("test_filterLedgerInvoices_matches_number_fragment_without_case", () => {
    expect(filterLedgerInvoices(rows, " fv/1 ", "all").map((row) => row.invoice)).toEqual(["FV/10", "FV/1"]);
  });

  it("test_filterLedgerInvoices_keeps_one_mode", () => {
    expect(filterLedgerInvoices(rows, "", "schedule").map((row) => row.invoice)).toEqual(["fv/2"]);
  });

  it("test_filterLedgerInvoices_empty_query_and_all_modes_keep_the_list", () => {
    expect(filterLedgerInvoices(rows, "   ", "all")).toHaveLength(3);
  });
});
