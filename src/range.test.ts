import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { webAppBootstrap } from "../scripts/build-page.mjs";
import {
  RANGE_ERROR,
  applyNoStartDate,
  blocksOnOrder,
  fieldsForSearch,
  foldPl,
  isoToSheetDate,
  matchingContractors,
  matchingTexts,
  openRatesWindow,
  rangeLabel,
  readWebAppUrl,
  selectMode,
  modeLabel,
  resolveContractorText,
  resolveListText,
  screenAfterApprove,
  screenAfterChangeRange,
  screenAfterOpenStats,
  screenAfterSearch,
  screenAfterStatsBack,
  searchParams,
  statsParams,
  selectedContractor,
  startSearch,
  webAppUrl,
  type ContractorListItem,
} from "./range.js";
import type { SettlementSearchResult } from "./search.js";

const LIST: ContractorListItem[] = [
  { nazwa: "GPW", dane: "GPW sp. z o.o., ul. Głogowska 12, Poznań" },
  { nazwa: "BLUECARGO", dane: "Blue Cargo, ul. Długa 1, Łódź" },
];

describe("matchingContractors", () => {
  it("test_matchingContractors_fragment_of_name_or_word_data_keeps_both", () => {
    expect(matchingContractors(LIST, "gpw", false).map((item) => item.nazwa)).toEqual(["GPW"]);
    expect(matchingContractors(LIST, "GŁOGOWSKA", false).map((item) => item.nazwa)).toEqual(["GPW"]);
    expect(matchingContractors(LIST, "lodz", false).map((item) => item.nazwa)).toEqual(["BLUECARGO"]);
  });

  it("test_matchingContractors_empty_query_returns_full_list", () => {
    expect(matchingContractors(LIST, "   ", false)).toEqual(LIST);
  });

  it("test_matchingContractors_text_outside_list_returns_empty", () => {
    expect(matchingContractors(LIST, "nie ma takiego", false)).toEqual([]);
  });

  it("test_resolveContractorText_exact_name_or_single_hit", () => {
    expect(resolveContractorText(LIST, "gpw")).toEqual({ contractor: "GPW", query: "GPW" });
    expect(resolveContractorText(LIST, "głogowska")).toEqual({ contractor: "GPW", query: "GPW" });
    expect(resolveContractorText(LIST, "a")).toEqual({ contractor: "", query: "a" });
    expect(resolveContractorText(LIST, "")).toEqual({ contractor: "", query: "" });
  });

  it("test_resolveListText_exact_or_single_fragment_keeps_list_spelling", () => {
    const addresses = ["ul. Hetmańska 90", "ul. Głogowska 12"];
    expect(matchingTexts(addresses, "HETM", false)).toEqual(["ul. Hetmańska 90"]);
    expect(matchingTexts(addresses, "   ", false)).toEqual(addresses);
    expect(resolveListText(addresses, "glogowska")).toEqual({
      value: "ul. Głogowska 12",
      query: "ul. Głogowska 12",
    });
    expect(resolveListText(addresses, "ul.")).toEqual({ value: "", query: "ul." });
    expect(resolveListText(addresses, "")).toEqual({ value: "", query: "" });
  });

  it("test_foldPl_polish_letters_fold", () => {
    expect(foldPl("  Łódź  ")).toBe("lodz");
  });
});

describe("selectedContractor", () => {
  it("test_selectedContractor_short_name_uses_list_spelling", () => {
    expect(selectedContractor(LIST, "gpw")?.nazwa).toBe("GPW");
  });

  it("test_selectedContractor_word_data_is_not_a_choice", () => {
    expect(selectedContractor(LIST, "Blue Cargo, ul. Długa 1, Łódź")).toBeNull();
    expect(selectedContractor(LIST, "spoza listy")).toBeNull();
    expect(selectedContractor(LIST, "")).toBeNull();
  });
});

describe("startSearch", () => {
  it("test_startSearch_without_contractor_does_not_start", () => {
    const result = startSearch({ contractor: "", from: "", to: "2026-09-18" }, LIST);
    expect(result).toEqual({ ok: false, error: "contractor" });
    expect(RANGE_ERROR.contractor).toBe("Wybierz podwykonawcę z listy.");
  });

  it("test_startSearch_text_outside_list_does_not_start", () => {
    expect(startSearch({ contractor: "spoza", from: "", to: "2026-09-18" }, LIST)).toEqual({
      ok: false,
      error: "contractor",
    });
  });

  it("test_startSearch_without_end_date_does_not_start", () => {
    const result = startSearch({ contractor: "GPW", from: "2026-09-01", to: "" }, LIST);
    expect(result).toEqual({ ok: false, error: "end" });
    expect(RANGE_ERROR.end).toBe("Data końcowa jest wymagana.");
  });

  it("test_startSearch_start_after_end_does_not_start", () => {
    const result = startSearch(
      { contractor: "GPW", from: "2026-09-19", to: "2026-09-18" },
      LIST,
    );
    expect(result).toEqual({ ok: false, error: "order" });
    expect(RANGE_ERROR.order).toBe("Data początkowa nie może być późniejsza niż końcowa.");
    expect(blocksOnOrder("2026-09-19", "2026-09-18", false)).toBe(true);
    expect(blocksOnOrder("2026-09-19", "2026-09-18", true)).toBe(false);
  });

  it("test_startSearch_same_day_is_that_one_day", () => {
    expect(startSearch({ contractor: "gpw", from: "2026-09-18", to: "2026-09-18" }, LIST)).toEqual({
      ok: true,
      podwykonawca: "GPW",
      dataOd: "18.09.2026",
      dataDo: "18.09.2026",
    });
  });

  it("test_startSearch_iso_date_does_not_shift_calendar_day", () => {
    expect(isoToSheetDate("2026-09-01")).toBe("01.09.2026");
    expect(isoToSheetDate("2024-02-29")).toBe("29.02.2024");
    expect(isoToSheetDate("2026-02-31")).toBeNull();
  });

  it("test_fieldsForSearch_no_start_date_drops_from", () => {
    const fields = fieldsForSearch({
      contractor: "GPW",
      from: "2026-09-01",
      to: "2026-09-18",
      noFrom: true,
    });
    const started = startSearch(fields, LIST);
    expect(started).toEqual({ ok: true, podwykonawca: "GPW", dataDo: "18.09.2026" });
    if (!started.ok) {
      return;
    }
    expect(searchParams(started)).toEqual({
      action: "settlementSearch",
      podwykonawca: "GPW",
      dataDo: "18.09.2026",
    });
    expect(rangeLabel(started)).toBe("GPW, bez daty początkowej do 18.09.2026");
  });
});

describe("applyNoStartDate", () => {
  it("test_applyNoStartDate_check_clears_and_uncheck_restores_last", () => {
    const cleared = applyNoStartDate({ from: "2026-09-01", held: "" }, true);
    expect(cleared).toEqual({ from: "", held: "2026-09-01" });
    expect(applyNoStartDate(cleared, false)).toEqual({ from: "2026-09-01", held: "2026-09-01" });
  });

  it("test_applyNoStartDate_check_without_date_keeps_previous_held", () => {
    expect(applyNoStartDate({ from: "", held: "2026-09-01" }, true)).toEqual({
      from: "",
      held: "2026-09-01",
    });
  });
});

describe("screens", () => {
  it("test_screenAfterChangeRange_returns_to_range", () => {
    expect(screenAfterSearch()).toBe("statement");
    expect(screenAfterChangeRange()).toBe("range");
  });

  it("test_screenAfterApprove_returns_to_range", () => {
    expect(screenAfterApprove()).toBe("range");
  });

  it("test_screenAfterOpenStats_and_back", () => {
    expect(screenAfterOpenStats()).toBe("stats");
    expect(screenAfterStatsBack()).toBe("range");
  });

  it("test_openRatesWindow_stays_on_current_screen", () => {
    expect(openRatesWindow("range")).toEqual({ screen: "range", window: "rates" });
    expect(openRatesWindow("statement")).toEqual({ screen: "statement", window: "rates" });
    expect(openRatesWindow("stats")).toEqual({ screen: "stats", window: "rates" });
    expect(selectMode("report")).toEqual({ report: true, schedule: false });
    expect(selectMode("schedule")).toEqual({ report: false, schedule: true });
    expect(modeLabel("report")).toBe("Na zgłoszenie");
    expect(modeLabel("schedule")).toBe("Harmonogram");
  });
});

describe("webAppUrl", () => {
  it("test_readWebAppUrl_query_wins_and_is_stored", () => {
    expect(readWebAppUrl("?webapp=https://example/exec", null)).toEqual({
      url: "https://example/exec",
      persist: "https://example/exec",
    });
    expect(readWebAppUrl("", " https://stored/exec ")).toEqual({
      url: "https://stored/exec",
      persist: null,
    });
    expect(readWebAppUrl("", null, " https://built/exec ")).toEqual({
      url: "https://built/exec",
      persist: null,
    });
    expect(readWebAppUrl("?webapp=https://query/exec", "https://stored/exec", "https://built/exec")).toEqual({
      url: "https://query/exec",
      persist: "https://query/exec",
    });
    expect(readWebAppUrl("", "https://stored/exec", "https://built/exec")).toEqual({
      url: "https://built/exec",
      persist: null,
    });
  });

  it("test_webAppBootstrap_embeds_secret_url", () => {
    expect(webAppBootstrap(" https://script.google.com/macros/s/abc/exec ")).toBe(
      'window.__ROZLICZENIA_WEBAPP__="https://script.google.com/macros/s/abc/exec";',
    );
    expect(webAppBootstrap("")).toBe('window.__ROZLICZENIA_WEBAPP__="";');
    expect(webAppBootstrap(undefined)).toBe('window.__ROZLICZENIA_WEBAPP__="";');
  });

  it("test_webAppUrl_appends_query", () => {
    expect(webAppUrl("https://example/exec", { action: "listContractors" })).toBe(
      "https://example/exec?action=listContractors",
    );
    expect(webAppUrl("https://example/exec?x=1", searchParams({
      ok: true,
      podwykonawca: "GPW",
      dataOd: "01.09.2026",
      dataDo: "18.09.2026",
    }))).toBe(
      "https://example/exec?x=1&action=settlementSearch&podwykonawca=GPW&dataDo=18.09.2026&dataOd=01.09.2026",
    );
  });
});

const gsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../arkusz-mapa/google-apps-script/transport-log.gs",
);

function loadRead(): (
  query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
  register: { sheetRow: number; cells: unknown[] }[],
  rates: { sheetRow: number; cells: unknown[] }[],
) => SettlementSearchResult {
  const gs = readFileSync(gsPath, "utf8");
  const start = gs.indexOf("/* settlement-read-pure:start */");
  const end = gs.indexOf("/* settlement-read-pure:end */");
  const block = gs.slice(start, end);
  const load = new Function(`${block}\nreturn buildSettlementRead_;`) as () => (
    query: { podwykonawca?: string; dataOd?: string; dataDo?: string },
    register: { sheetRow: number; cells: unknown[] }[],
    rates: { sheetRow: number; cells: unknown[] }[],
  ) => SettlementSearchResult;
  return load();
}

const read = loadRead();

function entry(sheetRow: number, date: string) {
  const cells = Array.from({ length: 18 }, () => "" as unknown);
  cells[0] = String(sheetRow);
  cells[1] = "Sklepowa 1";
  cells[4] = date;
  cells[5] = "gpw";
  return { sheetRow, cells };
}

describe("startSearch bounds", () => {
  const contractors = [{ nazwa: "gpw", dane: "dane" }];

  it("test_startSearch_same_day_includes_only_that_day", () => {
    const started = startSearch(
      { contractor: "gpw", from: "2026-09-18", to: "2026-09-18" },
      contractors,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    const result = read(
      started,
      [entry(2, "17.09.2026"), entry(3, "18.09.2026"), entry(4, "19.09.2026")],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.pickupDate)).toEqual(["18.09.2026"]);
  });

  it("test_startSearch_both_bounds_inclusive", () => {
    const started = startSearch(
      { contractor: "gpw", from: "2026-09-10", to: "2026-09-12" },
      contractors,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    const result = read(
      started,
      [
        entry(2, "09.09.2026"),
        entry(3, "10.09.2026"),
        entry(4, "11.09.2026"),
        entry(5, "12.09.2026"),
        entry(6, "13.09.2026"),
      ],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.pickupDate)).toEqual([
      "10.09.2026",
      "11.09.2026",
      "12.09.2026",
    ]);
  });

  it("test_startSearch_without_start_date_includes_through_end", () => {
    const started = startSearch(
      fieldsForSearch({ contractor: "gpw", from: "2026-09-01", to: "2026-09-18", noFrom: true }),
      contractors,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    const result = read(
      started,
      [entry(2, "17.09.2026"), entry(3, "18.09.2026"), entry(4, "19.09.2026")],
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows.map((row) => row.pickupDate)).toEqual(["17.09.2026", "18.09.2026"]);
  });
});
