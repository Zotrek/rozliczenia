import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rateContractorNames, rateSaveMessage, readAddressList, resolveStoreAddress, saveRateBody, storeAddressLabel, addressWithCommaAfterLocality, matchingStoreAddresses } from "./rateWindow.js";

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

describe("addressWithCommaAfterLocality", () => {
  it("test_addressWithCommaAfterLocality_when_postcode_should_put_comma_after_locality", () => {
    expect(addressWithCommaAfterLocality("98-300 Wieluń Sieradzka 62A")).toBe("98-300 Wieluń, Sieradzka 62A");
    expect(addressWithCommaAfterLocality("22-672 Susiec Turystyczna 27")).toBe("22-672 Susiec, Turystyczna 27");
    expect(addressWithCommaAfterLocality("63-000 Środa Wielkopolska Sienkiewicza 19")).toBe(
      "63-000 Środa Wielkopolska, Sienkiewicza 19",
    );
    expect(storeAddressLabel({ address: "98-300 Wieluń Sieradzka 62A", shop: "10 Wieluń" })).toBe(
      "10 Wieluń — 98-300 Wieluń, Sieradzka 62A",
    );
  });

  it("test_addressWithCommaAfterLocality_locality_hint_and_edge_cases", () => {
    expect(addressWithCommaAfterLocality("")).toBe("");
    expect(addressWithCommaAfterLocality("  ")).toBe("");
    expect(addressWithCommaAfterLocality("98-300 Wieluń, Sieradzka 1")).toBe("98-300 Wieluń, Sieradzka 1");
    expect(addressWithCommaAfterLocality("98-300 Wieluń Sieradzka 1", "Wieluń")).toBe("98-300 Wieluń, Sieradzka 1");
    expect(addressWithCommaAfterLocality("98-300 Wieluń", "Wieluń")).toBe("98-300 Wieluń");
    expect(addressWithCommaAfterLocality("ul. Bez kodu 1")).toBe("ul. Bez kodu 1");
    expect(addressWithCommaAfterLocality("26-900 Kozienice nad Wisłą 3")).toMatch(/Kozienice nad Wisłą,/);
    expect(storeAddressLabel({ address: "ul. A 1", shop: "ul. A 1" })).toBe("ul. A 1");
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
    expect(rateSaveMessage("amount")).toContain("kwota");
    expect(rateSaveMessage("addresses")).toContain("adresów");
    expect(rateSaveMessage("other")).toContain("Zapis nieudany");
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

describe("matchingStoreAddresses", () => {
  const items = [
    { address: "Sklepowa 1", shop: "Alpha" },
    { address: "Lipowa 2", shop: "Beta" },
  ];

  it("test_matchingStoreAddresses_browsing_or_empty_returns_all", () => {
    expect(matchingStoreAddresses(items, "xyz", true)).toEqual(items);
    expect(matchingStoreAddresses(items, "", false)).toEqual(items);
  });

  it("test_matchingStoreAddresses_fragment_of_address_or_shop", () => {
    expect(matchingStoreAddresses(items, "lip", false)).toEqual([items[1]]);
    expect(matchingStoreAddresses(items, "alp", false)).toEqual([items[0]]);
    expect(matchingStoreAddresses(items, "zzz", false)).toEqual([]);
  });
});
