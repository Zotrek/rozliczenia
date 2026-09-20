import { foldPl, isoToSheetDate } from "./range.js";
import type { ContractorListItem } from "./search.js";

/** Adres z kolumny 2 rejestru i nazwa z kolumny Sklep. Zapis stawki używa adresu. */
export interface StoreAddress {
  address: string;
  shop: string;
}

/** Widoczny tekst listy. Sam adres, gdy nazwy nie ma albo jest taka sama. */
export function storeAddressLabel(item: StoreAddress): string {
  const shop = item.shop.trim();
  const address = item.address.trim();
  if (shop !== "" && shop !== address) {
    return `${shop} — ${address}`;
  }
  return address;
}

/** Pola `saveRate` jak na mapie. Listy wybiera widok, tu jest tylko body. */
export function saveRateBody(input: {
  shop: string;
  contractor: string;
  pickup: string;
  bag: string;
  from: string;
}): { ok: false; error: "shop" | "date" } | { ok: true; body: Record<string, string> } {
  const shop = input.shop.trim();
  const contractor = input.contractor.trim();
  if (shop === "" || contractor === "") {
    return { ok: false, error: "shop" };
  }
  const rawFrom = input.from.trim();
  let odKiedy = "";
  if (rawFrom !== "") {
    const sheet = isoToSheetDate(rawFrom);
    if (sheet === null) {
      return { ok: false, error: "date" };
    }
    odKiedy = sheet;
  }
  return {
    ok: true,
    body: {
      mode: "saveRate",
      sklep: shop,
      podwykonawca: contractor,
      kwotaPodjazd: input.pickup,
      kwotaWorek: input.bag,
      odKiedy,
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

/** Fragment nazwy albo adresu. Pusty tekst albo przeglądanie zostawia całą listę. */
export function matchingStoreAddresses(
  items: readonly StoreAddress[],
  query: string,
  browsingAll: boolean,
): StoreAddress[] {
  if (browsingAll) {
    return [...items];
  }
  const folded = foldPl(query);
  if (folded === "") {
    return [...items];
  }
  return items.filter(
    (item) =>
      foldPl(item.address).includes(folded) ||
      foldPl(item.shop).includes(folded) ||
      foldPl(storeAddressLabel(item)).includes(folded),
  );
}

/** Dokładny adres albo dokładna etykieta, albo jedyne trafienie. Inaczej brak wyboru. */
export function resolveStoreAddress(
  items: readonly StoreAddress[],
  text: string,
): { address: string; query: string } {
  const folded = foldPl(text);
  if (folded === "") {
    return { address: "", query: "" };
  }
  const exact = items.find(
    (item) => foldPl(item.address) === folded || foldPl(storeAddressLabel(item)) === folded,
  );
  if (exact) {
    return { address: exact.address, query: storeAddressLabel(exact) };
  }
  const hits = matchingStoreAddresses(items, text, false);
  if (hits.length === 1) {
    return { address: hits[0].address, query: storeAddressLabel(hits[0]) };
  }
  return { address: "", query: text };
}

/** Odczyt `listStoreAddresses`. Sam tekst zostaje adresem bez nazwy. Pinezka z `lat` nie przechodzi. */
export function readAddressList(body: unknown): { ok: true; addresses: StoreAddress[] } | { ok: false } {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.data)) {
    return { ok: false };
  }
  const addresses: StoreAddress[] = [];
  for (const item of body.data) {
    const parsed = parseStoreAddress(item);
    if (parsed === null) {
      return { ok: false };
    }
    if (parsed.address !== "") {
      addresses.push(parsed);
    }
  }
  addresses.sort((a, b) => storeAddressLabel(a).localeCompare(storeAddressLabel(b), "pl"));
  return { ok: true, addresses };
}

function parseStoreAddress(item: unknown): StoreAddress | null {
  if (typeof item === "string") {
    return { address: item.trim(), shop: "" };
  }
  if (!isRecord(item) || "lat" in item || "lng" in item || typeof item.adres !== "string") {
    return null;
  }
  const shop = typeof item.sklep === "string" ? item.sklep.trim() : "";
  return { address: item.adres.trim(), shop };
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
