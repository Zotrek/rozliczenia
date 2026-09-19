import type { ContractorListItem } from "./search.js";

/** Pola `saveRate` jak na mapie. Listy wybiera widok, tu jest tylko body. */
export function saveRateBody(input: {
  shop: string;
  contractor: string;
  pickup: string;
  bag: string;
  from: string;
}): { ok: false; error: "shop" } | { ok: true; body: Record<string, string> } {
  const shop = input.shop.trim();
  const contractor = input.contractor.trim();
  if (shop === "" || contractor === "") {
    return { ok: false, error: "shop" };
  }
  return {
    ok: true,
    body: {
      mode: "saveRate",
      sklep: shop,
      podwykonawca: contractor,
      kwotaPodjazd: input.pickup,
      kwotaWorek: input.bag,
      odKiedy: input.from.trim(),
    },
  };
}

export function rateSaveMessage(code: unknown): string {
  if (code === "tie") {
    return "Więcej niż jeden wiersz tej daty. Zapisu nie ma.";
  }
  if (code === "date") {
    return "Data w formacie dd.mm.yyyy albo puste.";
  }
  if (code === "amount") {
    return "Nieprawidłowa kwota.";
  }
  if (code === "shop") {
    return "Wybierz sklep i podwykonawcę.";
  }
  if (code === "addresses") {
    return "Nie udało się wczytać adresów.";
  }
  return "Zapis nieudany.";
}

/** Odczyt `listStoreAddresses`. Obiekt pinezki nie przechodzi: to nie ta lista. */
export function readAddressList(body: unknown): { ok: true; addresses: string[] } | { ok: false } {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.data)) {
    return { ok: false };
  }
  const addresses: string[] = [];
  for (const item of body.data) {
    if (typeof item !== "string") {
      return { ok: false };
    }
    const text = item.trim();
    if (text !== "") {
      addresses.push(text);
    }
  }
  return { ok: true, addresses };
}

/** Nazwa krótka, nie Dane do Worda. Puste i powtórki odpadają. */
export function rateContractorNames(items: readonly ContractorListItem[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of items) {
    const name = item.nazwa.trim();
    if (name === "" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b, "pl"));
  return names;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
