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

  it("test_page_onChange_toggles_and_commits_edits", () => {
    const change = functionBody("onChange");
    expect(change).toContain('el.dataset.toggle === "bags-only"');
    expect(change).toContain('el.dataset.toggle === "notrip"');
    expect(change).toContain('el.dataset.toggle === "checked"');
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
    expect(html).not.toMatch(/\bimport\s/);
    expect(html).not.toMatch(/\bexport\s/);
  });
});
