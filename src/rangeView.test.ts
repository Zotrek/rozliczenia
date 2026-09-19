import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPage } from "../scripts/build-page.mjs";
import { CONTRACTOR_LIST_LIMIT, renderApp, renderModes, type RangeViewModel } from "./rangeView.js";
import type { StartedSearch } from "./range.js";
import { emptyStatement } from "./statement.js";

function model(over: Partial<RangeViewModel> = {}): RangeViewModel {
  return {
    contractorQuery: "",
    contractorOpen: false,
    contractor: "",
    contractors: [{ nazwa: "GPW", dane: "GPW <spółka>" }],
    from: "",
    to: "",
    noFrom: false,
    error: "",
    screen: "range",
    ratesOpen: false,
    loading: false,
    loadMessage: "",
    applied: null,
    status: "",
    webappMissing: false,
    statement: emptyStatement(),
    addresses: [],
    ratesShop: "",
    ratesContractor: "",
    ratesPickup: "",
    ratesBag: "",
    ratesFrom: "",
    ratesMessage: "",
    ratesMessageOk: false,
    ...over,
  };
}

const APPLIED: StartedSearch = {
  ok: true,
  podwykonawca: "GPW",
  dataOd: "01.09.2026",
  dataDo: "18.09.2026",
};

describe("renderModes", () => {
  it("test_renderModes_report_on_schedule_visible_and_disabled", () => {
    const html = renderModes();
    expect(html).toContain('id="mode-na" checked');
    expect(html).toContain("Na zgłoszenie");
    expect(html).toContain('id="mode-h" disabled');
    expect(html).toContain("Harmonogram");
    expect(html).not.toContain('id="mode-h" checked');
  });
});

describe("renderApp", () => {
  it("test_renderApp_rates_is_a_window_on_the_range_screen", () => {
    const html = renderApp(model({ ratesOpen: true }));
    expect(html).toContain('data-screen="range"');
    expect(html).toContain('data-window="rates"');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('data-screen="rates"');
    expect(html).toContain("Baza stawek");
  });

  it("test_renderApp_change_range_is_on_the_statement_screen", () => {
    const html = renderApp(
      model({ screen: "statement", applied: APPLIED, ratesOpen: true }),
    );
    expect(html).toContain('data-screen="statement"');
    expect(html).toContain("Zmień zakres");
    expect(html).toContain("GPW, od 01.09.2026 do 18.09.2026");
    expect(html).toContain('data-window="rates"');
    expect(html).not.toContain('data-screen="range"');
    expect(html).not.toContain('data-screen="rates"');
  });

  it("test_renderApp_escapes_contractor_word_data", () => {
    const html = renderApp(
      model({ contractor: "GPW", contractorQuery: "GPW", contractorOpen: false }),
    );
    expect(html).toContain("GPW &lt;spółka&gt;");
    expect(html).not.toContain("GPW <spółka>");
  });

  it("test_renderApp_contractor_list_shows_at_most_80_short_names", () => {
    const contractors = Array.from({ length: 120 }, (_, index) => ({
      nazwa: `Firma ${index}`,
      dane: `DANE-WORD-${index}`,
    }));
    const html = renderApp(
      model({ contractorOpen: true, contractorQuery: "", contractors }),
    );
    const buttons = html.match(/data-action="pick-contractor"/g) ?? [];
    expect(CONTRACTOR_LIST_LIMIT).toBe(80);
    expect(buttons).toHaveLength(80);
    expect(html).toContain("Firma 0");
    expect(html).toContain("Firma 79");
    expect(html).not.toContain("Firma 80");
    expect(html).not.toContain("DANE-WORD-0");
    expect(html).not.toContain("<small>");
  });

  it("test_renderApp_contractor_list_matches_word_data_but_shows_the_short_name", () => {
    const html = renderApp(
      model({
        contractorOpen: true,
        contractorQuery: "glogowska",
        contractors: [{ nazwa: "GPW", dane: "ul. Głogowska 12" }],
      }),
    );
    expect(html).toContain('data-nazwa="GPW"');
    expect(html).toContain(">GPW</span>");
    expect(html).not.toContain("Głogowska");
    expect(html).toContain('class="picker-wrap"');
    expect(html).toContain('role="option"');
  });

  it("test_renderApp_order_error_is_visible", () => {
    const html = renderApp(model({ error: "order", from: "2026-09-19", to: "2026-09-18" }));
    expect(html).toContain("Data początkowa nie może być późniejsza niż końcowa.");
  });

  it("test_renderApp_loading_below_10000_is_pulsing_logo", () => {
    const html = renderApp(model({ loading: true, loadKind: "logo", loadMessage: "Szukam…" }));
    expect(html).toContain('class="pulse"');
    expect(html).toContain("logo.png");
    expect(html).not.toContain("jednorozec-deba.gif");
  });

  it("test_renderApp_rates_window_lists_register_address_and_short_name", () => {
    const html = renderApp(
      model({
        ratesOpen: true,
        addresses: ["ul. Hetmańska 90", "ul. Głogowska 12"],
        contractors: [{ nazwa: "GPW", dane: "DANE-WORD-XYZ" }],
        ratesShop: "ul. Głogowska 12",
        ratesContractor: "GPW",
      }),
    );
    expect(html).toContain('<select data-rate="shop">');
    expect(html).toContain('<select data-rate="contractor">');
    expect(html).toContain("ul. Głogowska 12");
    expect(html).toContain(">GPW</option>");
    expect(html).not.toContain("DANE-WORD-XYZ");
    expect(html).not.toContain('data-rate="shop" type="text"');
    expect(html).not.toMatch(/<input[^>]*data-rate="shop"/);
    expect(html).not.toMatch(/<input[^>]*data-rate="contractor"/);
    expect(html).toContain("Kwota za podjazd");
    expect(html).toContain("Kwota za worek");
    expect(html).toContain("Od kiedy obowiązuje");
    expect(html).toContain('placeholder="dd.mm.yyyy"');
    expect(html).toContain('data-action="save-rates"');
    expect(html).not.toContain("resolveRateTie");
    expect(html).not.toContain("Stawka za trasę");
    expect(html).toContain("kolumn 16 i 17");
  });

  it("test_renderApp_approve_from_10000_is_unicorn_not_logo", () => {
    const html = renderApp(
      model({ loading: true, loadKind: "unicorn", loadMessage: "Zatwierdzam rozliczenie…" }),
    );
    expect(html).toContain("jednorozec-deba.gif");
    expect(html).toContain("Zatwierdzam rozliczenie…");
    expect(html).not.toContain('class="pulse"');
  });
});

describe("buildPage", () => {
  it("test_buildPage_one_html_one_copy_of_the_order_rule", () => {
    const html = buildPage();
    const needle = "Data początkowa nie może być późniejsza niż końcowa.";
    expect(html.split(needle).length - 1).toBe(1);
    expect(html).toContain('id="mode-h" disabled');
    expect(html).toContain("function startSearch");
    expect(html).not.toContain("mix-bar");
    expect(html).not.toMatch(/\bimport\s/);
  });
});

describe("contractor picker", () => {
  it("test_contractor_typing_updates_the_list_not_the_page", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.ts"),
      "utf8",
    );
    const start = source.indexOf('if (el.dataset.filter === "contractor")');
    const end = source.indexOf('if (el.dataset.filter === "from"', start);
    const branch = source.slice(start, end);
    expect(branch).toContain("syncContractorPicker()");
    expect(branch).not.toContain("paint(");
    const focus = source.slice(source.indexOf("function onFocusIn"), source.indexOf("function onFocusOut"));
    expect(focus).toContain("syncContractorPicker()");
    expect(focus).not.toContain("paint(");
    const press = source.slice(source.indexOf("function onMouseDown"), source.indexOf("function sheetRef"));
    expect(press).toContain("pickContractor(");
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "app.css"), "utf8");
    expect(css).toContain(".picker-wrap { position: relative;");
    expect(css).toMatch(/\[data-picker-list\] \{[^}]*position: absolute/);
  });
});
