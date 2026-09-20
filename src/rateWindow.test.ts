import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rateContractorNames, rateSaveMessage, readAddressList, resolveStoreAddress, saveRateBody } from "./rateWindow.js";

const gsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../arkusz-mapa/google-apps-script/transport-log.gs",
);
const gs = readFileSync(gsPath, "utf8");
const WRITE_CALL = /setValue|setValues|appendRow|insertSheet|deleteRow|deleteRows|getOrCreate|setFormula/;

function functionSource(name: string): string {
  const marker = `function ${name}(`;
  const start = gs.indexOf(marker);
  if (start < 0) {
    throw new Error(`brak funkcji ${name}`);
  }
  const brace = gs.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < gs.length; i++) {
    const ch = gs[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return gs.slice(start, i + 1);
      }
    }
  }
  throw new Error(`niezamknięta funkcja ${name}`);
}

function loadUnique(): (rows: unknown[]) => { adres: string; sklep: string }[] {
  const source = functionSource("uniqueStoreAddresses_");
  expect(source).not.toMatch(/SpreadsheetApp|LockService/);
  expect(source).not.toMatch(WRITE_CALL);
  const load = new Function(`${source}\nreturn uniqueStoreAddresses_;`) as () => (
    rows: unknown[],
  ) => { adres: string; sklep: string }[];
  return load();
}

const unique = loadUnique();

describe("saveRateBody", () => {
  it("test_saveRateBody_empty_and_zero_amounts_go_to_existing_saveRate", () => {
    expect(
      saveRateBody({ shop: " ul. A ", contractor: " GPW ", pickup: "", bag: "0", from: "  " }),
    ).toEqual({
      ok: true,
      body: {
        mode: "saveRate",
        sklep: "ul. A",
        podwykonawca: "GPW",
        kwotaPodjazd: "",
        kwotaWorek: "0",
        odKiedy: "",
      },
    });
  });

  it("test_saveRateBody_missing_shop_or_contractor_refuses", () => {
    expect(saveRateBody({ shop: "", contractor: "GPW", pickup: "1", bag: "1", from: "" }).ok).toBe(false);
    expect(saveRateBody({ shop: "ul. A", contractor: " ", pickup: "1", bag: "1", from: "" }).ok).toBe(false);
  });

  it("test_saveRateBody_does_not_carry_register_columns", () => {
    const built = saveRateBody({ shop: "ul. A", contractor: "GPW", pickup: "20", bag: "2", from: "2026-09-10" });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.body.odKiedy).toBe("10.09.2026");
    expect(built.body).not.toHaveProperty("action");
    expect(JSON.stringify(built.body)).not.toMatch(/rozliczony|faktury|koszt|resolveRateTie/i);
  });

  it("test_saveRateBody_invalid_calendar_date_refuses", () => {
    expect(saveRateBody({ shop: "ul. A", contractor: "GPW", pickup: "1", bag: "1", from: "2026-02-31" })).toEqual({
      ok: false,
      error: "date",
    });
  });
});

describe("readAddressList", () => {
  it("test_readAddressList_keeps_shop_name_and_legacy_address_string", () => {
    expect(
      readAddressList({
        ok: true,
        data: [{ adres: " ul. B ", sklep: " Sklep B " }, { adres: "", sklep: "puste" }, " ul. A ", { adres: "ul. C" }],
      }),
    ).toEqual({
      ok: true,
      addresses: [
        { address: "ul. B", shop: "Sklep B" },
        { address: "ul. A", shop: "" },
        { address: "ul. C", shop: "" },
      ],
    });
  });

  it("test_readAddressList_rejects_pin_objects", () => {
    expect(readAddressList({ ok: true, data: [{ adres: "ul. Z mapy", lat: 51, lng: 17 }] }).ok).toBe(false);
    expect(readAddressList({ ok: false }).ok).toBe(false);
  });
});

describe("resolveStoreAddress", () => {
  const shops = [
    { address: "ul. Głogowska 12", shop: "Biedronka" },
    { address: "ul. Hetmańska 90", shop: "Lewiatan" },
  ];

  it("test_resolveStoreAddress_shop_name_or_address_keeps_address_as_value", () => {
    expect(resolveStoreAddress(shops, "biedronka")).toEqual({
      address: "ul. Głogowska 12",
      query: "Biedronka — ul. Głogowska 12",
    });
    expect(resolveStoreAddress(shops, "ul. Głogowska 12")).toEqual({
      address: "ul. Głogowska 12",
      query: "Biedronka — ul. Głogowska 12",
    });
    expect(resolveStoreAddress(shops, "ul.")).toEqual({ address: "", query: "ul." });
  });
});

describe("rateContractorNames", () => {
  it("test_rateContractorNames_uses_short_name_not_word_data", () => {
    expect(
      rateContractorNames([
        { nazwa: "GPW", dane: "GPW spółka, NIP" },
        { nazwa: " GPW ", dane: "inne" },
        { nazwa: "", dane: "tylko word" },
        { nazwa: "BLUECARGO", dane: "" },
      ]),
    ).toEqual(["BLUECARGO", "GPW"]);
  });
});

describe("rateSaveMessage", () => {
  it("test_rateSaveMessage_tie_is_refusal_not_a_picker", () => {
    expect(rateSaveMessage("tie")).toContain("Zapisu nie ma");
    expect(rateSaveMessage("date")).toContain("dd.mm.yyyy");
    expect(rateSaveMessage("shop")).toContain("podwykonawcę");
  });
});

describe("listStoreAddresses w transport-log.gs", () => {
  it("test_listStoreAddresses_reads_register_address_and_shop_without_write", () => {
    const body = functionSource("listStoreAddresses_");
    expect(body).toContain("COL.adres");
    expect(body).toContain("COL.sklep");
    expect(body).toContain("uniqueStoreAddresses_");
    expect(body).not.toMatch(WRITE_CALL);
    expect(gs).toContain("action === 'listStoreAddresses'");
  });

  it("test_uniqueStoreAddresses_pairs_first_shop_name_and_keeps_one_address", () => {
    expect(
      unique([
        [" ul. B ", "PH", " Sklep B "],
        ["", "PH", "x"],
        ["ul. A", "PH", ""],
        ["ul. B", "PH", "inna"],
        ["ul. C", "PH", ""],
        ["ul. C", "PH", "Sklep C"],
      ]),
    ).toEqual([
      { adres: "ul. A", sklep: "" },
      { adres: "ul. B", sklep: "Sklep B" },
      { adres: "ul. C", sklep: "Sklep C" },
    ]);
  });
});
