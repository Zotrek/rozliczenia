import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPage } from "../scripts/build-page.mjs";

const srcDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(srcDir, "page.ts"), "utf8");

function functionBody(name: string): string {
  const marker = `function ${name}(`;
  const start = pageSource.indexOf(marker);
  if (start < 0) {
    throw new Error(`brak funkcji ${name}`);
  }
  const next = pageSource.indexOf("\nfunction ", start + marker.length);
  const end = next < 0 ? pageSource.length : next;
  return pageSource.slice(start, end);
}

describe("page wiring", () => {
  it("test_page_boot_wires_listeners_and_loads_contractors", () => {
    const boot = functionBody("boot");
    for (const event of ["click", "input", "change", "focusin", "focusout", "mousedown", "keydown"]) {
      expect(boot).toContain(`addEventListener("${event}"`);
    }
    expect(boot).toContain("paint()");
    expect(boot).toContain("loadContractors()");
    expect(boot).toContain("readWebAppUrl(");
  });

  it("test_page_view_defaults_range_dates_to_today", () => {
    expect(pageSource).toContain("defaultRangeDates(todayAtBoot)");
    expect(pageSource).toContain("from: defaultDates.from");
    expect(pageSource).toContain("to: defaultDates.to");
  });

  it("test_page_onClick_covers_range_statement_stats_and_rates_actions", () => {
    const click = functionBody("onClick");
    for (const action of [
      "pick-contractor",
      "search",
      "invoice-preview",
      "invoice-edit",
      "back",
      "nav",
      "stats-period",
      "stats-show",
      "stats-fold",
      "stats-table-fold",
      "stats-page",
      "pickup-menu",
      "pickup-sort",
      "pickup-clear",
      "pickup-clear-all",
      "pickup-ok",
      "pickup-cancel",
      "invoice-menu",
      "invoice-sort",
      "invoice-clear",
      "invoice-clear-all",
      "invoice-ok",
      "invoice-cancel",
      "statement-menu",
      "statement-sort",
      "statement-clear",
      "statement-clear-all",
      "statement-ok",
      "statement-cancel",
      "ledger-menu",
      "ledger-sort",
      "ledger-clear",
      "ledger-clear-all",
      "ledger-ok",
      "ledger-cancel",
      "ledger-period",
      "ledger-mode",
      "ledger-show",
      "ledger-page",
      "rates",
      "rates-tab",
      "close-rates",
      "save-rates",
      "expand",
      "detach",
      "invoice-detach",
      "save-invoice-edit",
      "attach",
      "resolve-tie",
      "approve",
    ]) {
      expect(click).toContain(`action === "${action}"`);
    }
    expect(click).toContain("runSearch()");
    expect(click).toContain("runInvoices()");
    expect(click).toContain("goMenu(");
    expect(click).not.toContain('action === "stats-back"');
    expect(click).toContain("runStats()");
    expect(click).toContain("runApprove()");
    expect(click).toContain("commitDetach(");
    expect(click).toContain("commitAttach(");
    expect(click).toContain("withoutTiedRates(");
  });

  it("test_page_check_updates_the_row_without_repainting_the_list", () => {
    const change = functionBody("onChange");
    const all = change.slice(
      change.indexOf('el.dataset.toggle === "checked-all"'),
      change.indexOf('el.dataset.toggle === "checked"'),
    );
    const one = change.slice(
      change.indexOf('el.dataset.toggle === "checked"'),
      change.indexOf('el.dataset.toggle === "notrip"'),
    );
    for (const branch of [all, one]) {
      expect(branch).toContain("syncCheckedRows()");
      expect(branch).not.toContain("paint(");
    }
    const sync = functionBody("syncCheckedRows");
    expect(sync).toContain("is-checked");
    expect(sync).toContain('data-out="sel-count"');
    expect(sync).toContain('data-out="sum-sel"');
    expect(sync).toContain('data-toggle="checked-all"');
    expect(sync).toContain('data-action="approve"');
    expect(sync).not.toContain("innerHTML");
  });

  it("test_page_paint_keeps_statement_list_scroll", () => {
    const paint = functionBody("paint");
    const htmlAt = paint.indexOf("root.innerHTML");
    expect(paint).toContain("readListScroll()");
    expect(paint).toContain("writeListScroll(scroll)");
    expect(paint).toContain("readMenuScroll()");
    expect(paint).toContain("writeMenuScroll(menuScroll)");
    expect(paint.indexOf("readListScroll()")).toBeLessThan(htmlAt);
    expect(paint.indexOf("readMenuScroll()")).toBeLessThan(htmlAt);
    expect(paint.lastIndexOf("writeListScroll(scroll)")).toBeGreaterThan(htmlAt);
    expect(paint.lastIndexOf("writeMenuScroll(menuScroll)")).toBeGreaterThan(htmlAt);
    expect(paint).toContain("preventScroll: true");
    const read = functionBody("readListScroll");
    const write = functionBody("writeListScroll");
    expect(read).toContain(".table-wrap");
    expect(read).toContain("scrollTop");
    expect(read).toContain("scrollLeft");
    expect(write).toContain("scrollTop");
    expect(write).toContain("scrollLeft");
    expect(write).toContain("requestAnimationFrame");
    expect(functionBody("readMenuScroll")).toContain(".xl-values");
    expect(functionBody("writeMenuScroll")).toContain("scrollTop");
  });

  it("test_page_paint_keeps_stats_report_scroll", () => {
    const paint = functionBody("paint");
    const htmlAt = paint.indexOf("root.innerHTML");
    expect(paint).toContain("readStatsScroll()");
    expect(paint).toContain("writeStatsScroll(statsScroll)");
    expect(paint.indexOf("readStatsScroll()")).toBeLessThan(htmlAt);
    expect(paint.lastIndexOf("writeStatsScroll(statsScroll)")).toBeGreaterThan(htmlAt);
    const read = functionBody("readStatsScroll");
    const write = functionBody("writeStatsScroll");
    expect(read).toContain(".stats .body");
    expect(read).toContain("scrollTop");
    expect(write).toContain(".stats .body");
    expect(write).toContain("scrollTop");
    expect(write).toContain("requestAnimationFrame");
    expect(write).toContain("armScrollRestore(");
    expect(functionBody("writeListScroll")).toContain("armScrollRestore(");
    expect(functionBody("onCaptureScroll")).toContain("scrollRestoreGen");
    const arm = functionBody("armScrollRestore");
    expect(arm).toContain("scrollRestoreGen");
    expect(arm).toContain("requestAnimationFrame");
  });

  it("test_page_onChange_toggles_and_commits_edits", () => {
    const change = functionBody("onChange");
    expect(change).not.toContain('el.dataset.toggle === "bags-only"');
    expect(change).not.toContain("setBagsOnly(");
    expect(change).toContain('el.dataset.toggle === "notrip"');
    expect(change).toContain('el.dataset.toggle === "checked"');
    expect(change).toContain('el.dataset.toggle === "checked-all"');
    expect(change).toContain("setLinesSelected(");
    expect(change).toContain('el.dataset.toggle === "nofrom"');
    expect(change).toContain("setDidNotHappen(");
    expect(change).toContain("toggleSelected(");
    expect(change).toContain("applyNoStartDate(");
    expect(change).toContain("commitEdit(");
  });

  it("test_page_onInput_keeps_contractor_picker_without_full_paint", () => {
    const input = functionBody("onInput");
    const start = input.indexOf('el.dataset.filter === "contractor"');
    const end = input.indexOf('el.dataset.filter === "from"', start);
    const branch = input.slice(start, end);
    expect(branch).toContain("syncContractorPicker()");
    expect(branch).not.toContain("paint(");
    expect(input).toContain("typeRateField(");
  });

  it("test_page_invoices_open_from_the_same_range_without_a_write", () => {
    const click = functionBody("onClick");
    expect(click).toContain('action === "invoice-preview"');
    expect(click).toContain('action === "invoice-edit"');
    expect(click).toContain("armPickupWork(");
    expect(click).toContain("screenAfterWorkBack(");
    expect(click).not.toContain('action === "invoices"');
    const run = functionBody("runInvoices");
    expect(run).toContain("loadInvoiceRows(");
    expect(run).toContain("rowsOfInvoice(");
    expect(run).toContain("screenAfterInvoices()");
    expect(run).not.toContain("postSheet(");
    expect(run).not.toContain("buildApprove(");
    const load = functionBody("loadInvoiceRows");
    expect(load).toContain("invoiceParams(");
    expect(load).toContain("readSettledInvoices(");
    expect(functionBody("armPickupWork")).toContain("sheetToIsoDate(");
    const search = functionBody("runSearch");
    expect(search).toContain("invoice: VIEW.invoiceFocus");
    expect(search).toContain("loadInvoiceRows(");
    expect(search).toContain("rowsOfInvoice(");
  });

  it("test_page_menu_keeps_statement_and_loaded_stats", () => {
    const menu = functionBody("goMenu");
    expect(menu).toContain("VIEW.searched");
    expect(menu).toContain('place === "statement"');
    expect(menu).toContain("openStats()");
    expect(menu).not.toContain("runSearch(");
    expect(menu).not.toContain("runStats(");
    expect(menu).not.toContain("VIEW.statement");
    expect(menu).not.toContain("VIEW.invoiceFocus");
    const open = functionBody("openStats");
    expect(open.indexOf("VIEW.stats.report !== null")).toBeLessThan(open.indexOf("emptyStats("));
    expect(open).toContain("contractor: VIEW.contractor");
    expect(open).toContain("void runStats()");
    expect(functionBody("runSearch")).toContain("VIEW.searched = true");
    expect(functionBody("runInvoices")).not.toContain("VIEW.searched");
    const mode = functionBody("onChange");
    const modeNa = mode.slice(mode.indexOf('el.id === "mode-na"'), mode.indexOf('el.id === "mode-h"'));
    expect(modeNa).not.toContain("runSearch(");
    expect(modeNa).not.toContain("runStats(");
  });

  it("test_page_stats_helpers_persist_fold_and_reload_report", () => {
    expect(functionBody("openStats")).toContain("screenAfterOpenStats()");
    expect(functionBody("goMenu")).toContain("openLedger()");
    expect(functionBody("openLedger")).toContain("screenAfterOpenLedger()");
    expect(functionBody("openLedger")).toContain("void runLedger()");
    expect(functionBody("armPickupWork")).toContain('VIEW.workReturn = fromLedger ? "ledger" : "stats"');
    expect(functionBody("failOpen")).toContain('VIEW.workReturn === "ledger"');
    expect(functionBody("runLedger")).toContain("listPeriodInvoices(");
    expect(functionBody("runLedger")).toContain("scheduleRows");
    expect(functionBody("toggleStatsSection")).toContain("writeStatsFold(");
    expect(functionBody("toggleStatsTable")).toContain("writeStatsFold(");
    expect(functionBody("runStats")).toContain("readSettlementStats(");
    expect(functionBody("runStats")).toContain("buildStatsReport(");
    expect(functionBody("runStats")).toContain("loadTablesCollapsed(");
    expect(functionBody("runStats")).toContain("invoicesPage: 1");
    expect(functionBody("shiftStatsPage")).toContain('pager === "invoices"');
  });

  it("test_page_writes_go_through_writeNow_and_reload", () => {
    const writeNow = functionBody("writeNow");
    expect(writeNow).toContain("postSheet(");
    expect(writeNow).toContain("reloadStatement(");
    expect(functionBody("commitEdit")).toContain("commitBags(");
    expect(functionBody("commitEdit")).toContain("pickupDateBody(");
    expect(functionBody("commitEdit")).toContain("reloadStatement(");
    expect(functionBody("commitEdit")).toContain("commitRouteRate(");
    expect(functionBody("runApprove")).toContain("buildApprove(");
    expect(functionBody("saveRates")).toContain("saveRateBody(");
    expect(functionBody("saveRates")).toContain("saveRateHarmonogramBody(");
    expect(functionBody("saveRates")).toContain('VIEW.screen === "statement"');
    expect(functionBody("saveRates")).toContain("reloadStatement(");
    expect(functionBody("saveRates")).not.toContain('VIEW.mode === "report"');
    expect(functionBody("onClick")).toContain('action === "rates-tab"');
  });

  it("test_page_invoice_comment_writes_the_register_column", () => {
    const click = functionBody("onClick");
    expect(click).toContain('action === "apply-comment"');
    expect(click).toContain('action === "apply-invoice-comment"');
    expect(click).toContain("applyStatementComment(");
    expect(click).toContain("applyInvoiceComment(");
    const apply = functionBody("applyStatementComment");
    expect(apply).toContain("applyComments(");
    expect(apply).toContain("invoiceCommentBody(");
    expect(apply).toContain("writeNow(");
    expect(apply).toContain("commentSaveFace(");
    expect(apply).toContain("rememberInvoiceComment(");
    expect(functionBody("applyInvoiceComment")).toContain("commentSaveFace(");
    expect(functionBody("commitInvoiceComment")).toContain("commentSaveFace(");
    expect(functionBody("applyPickupFilter")).toContain("pickupFiltersAfterApply(");
    expect(functionBody("setPickupDraftVisible")).toContain("pickupDraftAfterVisible(");
    expect(functionBody("applyInvoiceFilter")).toContain("invoiceFiltersAfterApply(");
    expect(functionBody("setInvoiceDraftVisible")).toContain("pickupDraftAfterVisible(");
    expect(functionBody("onInput")).toContain('el.dataset.keep === "invoice-query"');
    expect(functionBody("onChange")).toContain("el.dataset.invoiceValue");
    expect(functionBody("onKeyDown")).toContain("applyInvoiceFilter(");
    expect(functionBody("applyInvoiceComment")).toContain("writeNow(");
    expect(functionBody("applyInvoiceComment")).toContain("rememberInvoiceComment(");
    expect(functionBody("commitInvoiceComment")).toContain("invoiceCommentBody(");
    expect(functionBody("commitInvoiceComment")).toContain("writeNow(");
    expect(functionBody("onChange")).toContain('el.dataset.commentFor === "row"');
    expect(functionBody("onChange")).toContain("commitInvoiceComment(");
    expect(functionBody("onChange")).toContain('el.dataset.pick === "comment"');
    expect(functionBody("onChange")).toContain("el.dataset.pickRoute");
    expect(functionBody("onChange")).toContain('el.dataset.invoicePick === "1"');
    expect(functionBody("onInput")).toContain('el.dataset.draft === "comment"');
    expect(functionBody("onInput")).toContain('el.dataset.commentFor === "row"');
    expect(functionBody("syncCommentChrome")).toContain("indeterminate");
    const draft = functionBody("onInput");
    const start = draft.indexOf('el.dataset.draft === "comment"');
    const end = draft.indexOf('el.dataset.draft === "invoice-bulk"', start);
    expect(draft.slice(start, end)).not.toContain("paint(");
  });
});

describe("buildPage bundle", () => {
  it("test_buildPage_embeds_page_boot_and_all_screens", () => {
    const html = buildPage();
    expect(html).toContain("boot()");
    expect(html).toContain("function resolveRate");
    expect(html).toContain("function escapeHtml");
    expect(html).toContain("function renderStatsScreen");
    expect(html).toContain("function renderStatement");
    expect(html).toContain("function renderInvoiceList");
    expect(html).toContain("function renderApp");
    expect(html).toContain('id="roz-error-stack"');
    expect(html).toContain("function showRozErrorCard");
    expect(html).toContain("ROZ-E-AUTH-MISMATCH");
    expect(html).not.toMatch(/\bimport\s/);
    expect(html).not.toMatch(/\bexport\s/);
    const script = html.slice(html.lastIndexOf("<script>") + "<script>".length, html.lastIndexOf("</script>"));
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("error cards", () => {
  it("test_page_operational_failures_keep_a_copyable_card", () => {
    for (const code of [
      "ROZ-E-CONTRACTORS",
      "ROZ-E-SEARCH",
      "ROZ-E-ADDRESSES",
      "ROZ-E-RATE-SAVE",
      "ROZ-E-WRITE",
      "ROZ-E-APPROVE",
      "ROZ-E-APPROVE-PARTIAL",
      "ROZ-E-REFRESH",
      "ROZ-E-STATS",
      "ROZ-E-INVOICES",
      "ROZ-E-WEBAPP",
      "ROZ-E-STORAGE",
    ]) {
      expect(pageSource).toContain(code);
    }
    const edit = functionBody("commitEdit");
    const approveAt = edit.indexOf("async function runApprove");
    const editOnly = approveAt < 0 ? edit : edit.slice(0, approveAt);
    expect(editOnly).not.toContain("reportFailure(");
    expect(functionBody("runApprove")).toContain("STATEMENT_ERROR[built.error]");
  });
});
