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
      "back",
      "stats",
      "stats-back",
      "stats-period",
      "stats-show",
      "stats-fold",
      "stats-table-fold",
      "stats-page",
      "rates",
      "rates-tab",
      "close-rates",
      "save-rates",
      "expand",
      "detach",
      "attach",
      "resolve-tie",
      "approve",
    ]) {
      expect(click).toContain(`action === "${action}"`);
    }
    expect(click).toContain("runSearch()");
    expect(click).toContain("openStats()");
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
      change.indexOf('el.dataset.toggle === "bags-only"'),
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
    expect(paint.indexOf("readListScroll()")).toBeLessThan(htmlAt);
    expect(paint.lastIndexOf("writeListScroll(scroll)")).toBeGreaterThan(htmlAt);
    expect(paint).toContain("preventScroll: true");
    const read = functionBody("readListScroll");
    const write = functionBody("writeListScroll");
    expect(read).toContain(".table-wrap");
    expect(read).toContain("scrollTop");
    expect(read).toContain("scrollLeft");
    expect(write).toContain("scrollTop");
    expect(write).toContain("scrollLeft");
    expect(write).toContain("requestAnimationFrame");
  });

  it("test_page_onChange_toggles_and_commits_edits", () => {
    const change = functionBody("onChange");
    expect(change).toContain('el.dataset.toggle === "bags-only"');
    expect(change).toContain('el.dataset.toggle === "notrip"');
    expect(change).toContain('el.dataset.toggle === "checked"');
    expect(change).toContain('el.dataset.toggle === "checked-all"');
    expect(change).toContain("setAllSelected(");
    expect(change).toContain('el.dataset.toggle === "nofrom"');
    expect(change).toContain("setBagsOnly(");
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

  it("test_page_stats_helpers_persist_fold_and_reload_report", () => {
    expect(functionBody("openStats")).toContain("screenAfterOpenStats()");
    expect(functionBody("toggleStatsSection")).toContain("writeStatsFold(");
    expect(functionBody("toggleStatsTable")).toContain("writeStatsFold(");
    expect(functionBody("runStats")).toContain("readSettlementStats(");
    expect(functionBody("runStats")).toContain("buildStatsReport(");
    expect(functionBody("runStats")).toContain("loadTablesCollapsed(");
  });

  it("test_page_writes_go_through_writeNow_and_reload", () => {
    const writeNow = functionBody("writeNow");
    expect(writeNow).toContain("postSheet(");
    expect(writeNow).toContain("reloadStatement(");
    expect(functionBody("commitEdit")).toContain("commitBags(");
    expect(functionBody("commitEdit")).toContain("commitRouteRate(");
    expect(functionBody("runApprove")).toContain("buildApprove(");
    expect(functionBody("saveRates")).toContain("saveRateBody(");
    expect(functionBody("saveRates")).toContain("saveRateHarmonogramBody(");
    expect(functionBody("saveRates")).toContain('VIEW.screen === "statement"');
    expect(functionBody("saveRates")).toContain("reloadStatement(");
    expect(functionBody("saveRates")).not.toContain('VIEW.mode === "report"');
    expect(functionBody("onClick")).toContain('action === "rates-tab"');
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
    expect(html).toContain("function renderApp");
    expect(html).toContain('id="roz-error-stack"');
    expect(html).toContain("function showRozErrorCard");
    expect(html).toContain("ROZ-E-AUTH-MISMATCH");
    expect(html).not.toMatch(/\bimport\s/);
    expect(html).not.toMatch(/\bexport\s/);
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
