import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPage } from "../scripts/build-page.mjs";
import { CONTRACTOR_LIST_LIMIT, emptyStats, renderApp, renderModes, type RangeViewModel } from "./rangeView.js";
import type { StartedSearch } from "./range.js";
import { emptyInvoiceComment } from "./invoiceComment.js";
import { emptyStatement } from "./statement.js";

function model(over: Partial<RangeViewModel> = {}): RangeViewModel {
  return {
    mode: "report",
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
    invoices: [],
    invoiceComment: emptyInvoiceComment(),
    invoiceFocus: null,
    invoiceNotice: "",
    workReturn: "range",
    searched: false,
    addresses: [],
    ratesShop: "",
    ratesShopQuery: "",
    ratesShopOpen: false,
    ratesContractor: "",
    ratesContractorQuery: "",
    ratesContractorOpen: false,
    ratesPickup: "",
    ratesBag: "",
    ratesFrom: "",
    ratesDays: "",
    ratesTarget: "stawki",
    ratesMessage: "",
    ratesMessageOk: false,
    stats: emptyStats({ year: 2026, month: 9, day: 23 }),
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
  it("test_renderModes_report_on_schedule_selectable", () => {
    const html = renderModes("report");
    expect(html).toContain('id="mode-na" checked');
    expect(html).toContain("Na zgłoszenie");
    expect(html).toContain('id="mode-h"');
    expect(html).not.toContain("disabled");
    expect(html).not.toContain('id="mode-h" checked');
    expect(html).toContain("Harmonogram");
  });

  it("test_renderModes_schedule_can_be_selected", () => {
    const html = renderModes("schedule");
    expect(html).toContain('id="mode-h" checked');
    expect(html).toContain('id="mode-na"');
    expect(html).not.toContain('id="mode-na" checked');
    expect(html).not.toContain("disabled");
    expect(renderApp(model({ mode: "schedule" }))).toContain("<em>Harmonogram</em>");
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
    expect(html).toContain("Baza cen harmonogram");
    expect(html).toContain('data-action="rates-tab"');
  });

  it("test_renderApp_rates_harmonogram_tab_shows_days_field", () => {
    const html = renderApp(model({ ratesOpen: true, ratesTarget: "harmonogram", ratesDays: "pn, cz" }));
    expect(html).toContain("Baza cen harmonogram");
    expect(html).toContain('data-rate="days"');
    expect(html).toContain("pn, cz");
    expect(html).toContain("Zapisz stawkę harmonogramu");
  });

  it("test_renderApp_schedule_statement_shows_approve", () => {
    const html = renderApp(
      model({
        mode: "schedule",
        screen: "statement",
        applied: APPLIED,
      }),
    );
    expect(html).toContain('data-action="approve"');
    expect(html).not.toContain("Zatwierdzenie faktury w tej wersji niedostępne");
  });

  it("test_renderApp_statement_keeps_the_range_and_opens_rates_without_changing_screen", () => {
    const html = renderApp(
      model({ screen: "statement", applied: APPLIED, searched: true, ratesOpen: true }),
    );
    expect(html).toContain('data-screen="statement"');
    expect(html).not.toContain("Zmień zakres");
    expect(html).not.toContain("Rozliczone faktury");
    expect(html).toContain("GPW, od 01.09.2026 do 18.09.2026");
    expect(html).toContain('data-window="rates"');
    expect(html).not.toContain('data-screen="range"');
    expect(html).not.toContain('data-screen="rates"');
    const sheet = html.slice(html.indexOf('data-screen="statement"'), html.indexOf('data-window="rates"'));
    expect(sheet).not.toContain('data-action="rates"');
    expect(sheet).not.toContain("← Statystyki");
    expect(html).toContain('class="is-on" data-action="nav" data-place="statement"');
  });

  it("test_renderApp_menu_places_and_rates_are_on_every_screen", () => {
    const range = renderApp(model({ screen: "range" }));
    expect(range).toContain('aria-label="Miejsca"');
    expect(range).toContain('class="is-on" data-action="nav" data-place="range"');
    expect(range).toContain('data-place="statement" disabled');
    expect(range).toContain('title="Najpierw Szukaj na Zakresie"');
    expect(range).not.toContain("setup-foot");
    expect(range).not.toContain('data-action="invoices"');
    expect(range).not.toContain("Rozliczone faktury");
    expect(range).toContain("<em>Na zgłoszenie</em>");
    expect(range.match(/src="logo.png"/g)).toHaveLength(1);
    const card = range.slice(range.indexOf('data-screen="range"'));
    expect(card).toContain('data-action="search"');
    expect(card).toContain('id="mode-na"');
    expect(card).not.toContain('data-action="rates"');
    expect(card).not.toContain('data-action="nav"');
    const ready = renderApp(model({ screen: "range", searched: true, applied: APPLIED }));
    expect(ready).not.toMatch(/data-place="statement"[^>]*disabled/);
    const stats = renderApp(model({ screen: "stats", mode: "schedule", searched: true }));
    expect(stats).toContain('data-screen="stats"');
    expect(stats).toContain('class="is-on" data-action="nav" data-place="stats"');
    expect(stats).toContain("<em>Statystyki</em>");
    expect(stats).not.toContain("<em>Harmonogram</em>");
    expect(stats).not.toContain("← Powrót");
    expect(stats).not.toContain('data-action="stats-back"');
    expect(stats).toContain("Pokaż raport");
    expect(stats).toContain('data-action="rates"');
    expect(stats).not.toContain('data-screen="range"');
    const preview = renderApp(model({ screen: "invoices", mode: "schedule", applied: APPLIED }));
    expect(preview).toContain('class="is-on" data-action="nav" data-place="stats"');
    expect(preview).toContain("<em>Harmonogram</em>");
    expect(preview).toContain("← Statystyki");
    expect(preview).toContain('data-action="rates"');
  });

  it("test_renderApp_invoices_screen_lists_saved_invoice_without_approve", () => {
    const html = renderApp(
      model({
        screen: "invoices",
        applied: APPLIED,
        invoices: [
          {
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
          },
        ],
      }),
    );
    expect(html).toContain('data-screen="invoices"');
    expect(html).toContain("Podgląd rozliczonych");
    expect(html).toContain("FV/1");
    expect(html).toContain("150,00");
    expect(html).toContain("← Statystyki");
    expect(html).not.toContain("Zmień zakres");
    expect(html).toContain('data-invoice="FV/1"');
    expect(html).not.toContain("is-focus");
    const fromStats = renderApp(
      model({
        screen: "invoices",
        applied: APPLIED,
        workReturn: "stats",
        invoiceFocus: "FV/1",
        invoices: [
          {
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
          },
          {
            sheetName: "Arkusz1",
            sheetRow: 3,
            transportNumber: "11",
            address: "Inna 2",
            shopName: "Sklep Obcy",
            pickupDate: "16.09.2026",
            contractor: "GPW",
            bagCount: 1,
            routeName: "",
            invoice: "FV/2",
            receptionCost: 2000,
            costPerBag: 2000,
          },
        ],
      }),
    );
    expect(fromStats).toContain("← Statystyki");
    expect(fromStats).toContain("Podgląd faktury");
    expect(fromStats).toContain("FV/1 ·");
    expect(fromStats).toContain("is-focus");
    expect(fromStats).not.toContain("FV/2");
    expect(fromStats).not.toContain("Sklep Obcy");
    expect(html).not.toContain("Zatwierdź");
    expect(html).not.toContain('data-screen="range"');
  });

  it("test_renderApp_statement_from_stats_shows_only_the_chosen_invoice", () => {
    const invoices = [
      {
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
      },
      {
        sheetName: "Arkusz1",
        sheetRow: 3,
        transportNumber: "11",
        address: "Inna 2",
        shopName: "Sklep Obcy",
        pickupDate: "16.09.2026",
        contractor: "GPW",
        bagCount: 1,
        routeName: "",
        invoice: "FV/2",
        receptionCost: 2000,
        costPerBag: 2000,
      },
    ];
    const html = renderApp(
      model({
        screen: "statement",
        applied: APPLIED,
        searched: true,
        workReturn: "stats",
        invoiceFocus: "FV/1",
        invoices,
      }),
    );
    expect(html).toContain('data-screen="statement"');
    expect(html).toContain("← Statystyki");
    expect(html).toContain('class="is-on" data-action="nav" data-place="statement"');
    expect(html).toContain("Pozycje tej faktury");
    expect(html).toContain("Sklep A");
    expect(html).not.toContain("Sklep Obcy");
    const openSchedule = renderApp(
      model({ screen: "statement", applied: APPLIED, workReturn: "stats", invoices }),
    );
    expect(openSchedule).not.toContain("Pozycje tej faktury");
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
        addresses: [
          { address: "ul. Hetmańska 90", shop: "Lewiatan" },
          { address: "ul. Głogowska 12", shop: "Biedronka" },
        ],
        contractors: [{ nazwa: "GPW", dane: "DANE-WORD-XYZ" }],
        ratesShop: "ul. Głogowska 12",
        ratesShopQuery: "Biedronka — ul. Głogowska 12",
        ratesShopOpen: true,
        ratesContractor: "GPW",
        ratesContractorQuery: "GPW",
      }),
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-rate="shop"');
    expect(html).toContain('data-rate="contractor"');
    expect(html).toContain("Biedronka — ul. Głogowska 12");
    expect(html).toContain("Lewiatan — ul. Hetmańska 90");
    expect(html).toContain('data-value="ul. Głogowska 12"');
    expect(html).toContain('data-value="ul. Hetmańska 90"');
    expect(html).toContain('value="GPW"');
    expect(html).not.toContain("DANE-WORD-XYZ");
    expect(html).not.toContain("<select");
    expect(html).toContain("Kwota za podjazd");
    expect(html).toContain("Kwota za worek");
    expect(html).toContain("Od kiedy obowiązuje");
    expect(html).toContain('type="date" data-rate="from"');
    expect(html).toContain('data-action="save-rates"');
    expect(html).not.toContain("resolveRateTie");
    expect(html).not.toContain("Stawka za trasę");
    expect(html).not.toContain("kolumn 16 i 17");
  });

  it("test_renderApp_rates_contractor_combobox_matches_word_data_but_shows_the_short_name", () => {
    const html = renderApp(
      model({
        ratesOpen: true,
        ratesContractorOpen: true,
        ratesContractorQuery: "dane-word",
        contractors: [{ nazwa: "GPW", dane: "DANE-WORD-XYZ" }],
      }),
    );
    expect(html).toContain('data-action="pick-rate-contractor"');
    expect(html).toContain('data-value="GPW"');
    expect(html).not.toContain("DANE-WORD-XYZ");
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
    expect(html).toContain('id="mode-h"');
    expect(html).not.toContain('id="mode-h" disabled');
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
