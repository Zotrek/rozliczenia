import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rateContractorNames, rateSaveMessage, readAddressList, saveRateBody } from "./rateWindow.js";

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

function loadUnique(): (cells: unknown[]) => string[] {
  const source = functionSource("uniqueStoreAddresses_");
  expect(source).not.toMatch(/SpreadsheetApp|LockService/);
  expect(source).not.toMatch(WRITE_CALL);
  const load = new Function(`${source}\nreturn uniqueStoreAddresses_;`) as () => (cells: unknown[]) => string[];
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
    const built = saveRateBody({ shop: "ul. A", contractor: "GPW", pickup: "20", bag: "2", from: "10.09.2026" });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.body).not.toHaveProperty("action");
    expect(JSON.stringify(built.body)).not.toMatch(/rozliczony|faktury|koszt|resolveRateTie/i);
  });
});

describe("readAddressList", () => {
  it("test_readAddressList_keeps_address_strings_and_drops_blanks", () => {
    expect(readAddressList({ ok: true, data: [" ul. B ", "", "ul. A"] })).toEqual({
      ok: true,
      addresses: ["ul. B", "ul. A"],
    });
  });

  it("test_readAddressList_rejects_pin_objects", () => {
    expect(readAddressList({ ok: true, data: [{ adres: "ul. Z mapy" }] }).ok).toBe(false);
    expect(readAddressList({ ok: false }).ok).toBe(false);
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
  it("test_listStoreAddresses_reads_register_address_column_without_write", () => {
    const body = functionSource("listStoreAddresses_");
    expect(body).toContain("COL.adres");
    expect(body).toContain("uniqueStoreAddresses_");
    expect(body).not.toContain("COL.sklep");
    expect(body).not.toMatch(WRITE_CALL);
    expect(gs).toContain("action === 'listStoreAddresses'");
  });

  it("test_uniqueStoreAddresses_trims_drops_empty_and_keeps_one", () => {
    expect(unique([" ul. B ", "", "ul. A", "ul. B", "  ", null])).toEqual(["ul. A", "ul. B"]);
  });
});
