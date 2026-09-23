import { foldPl, isoToSheetDate } from "./range.js";
import type { ContractorListItem } from "./search.js";

/** Adres z kolumny 2 rejestru i nazwa z kolumny Sklep. Zapis stawki używa adresu. */
export interface StoreAddress {
  address: string;
  shop: string;
}

const LOCALITY_SECOND_WORD = new Set([
  "gora",
  "sol",
  "targ",
  "dunajec",
  "gdanski",
  "podlaski",
  "podlaska",
  "mazowiecka",
  "mazowiecki",
  "wielkopolska",
  "wielkopolski",
  "wilekopolski",
  "wlkp",
  "deba",
  "sacz",
  "zabkowicki",
  "zabkowicka",
  "lodzki",
  "lodzka",
  "swietokrzyski",
  "swietokrzyska",
  "trybunalski",
  "slaski",
  "slaska",
]);

function foldLocality(text: string): string {
  return foldPl(text).replace(/\./g, "");
}

function foldAddress(text: string): string {
  return foldPl(text).replace(/,/g, "");
}

function splitLeadingPostcode(address: string): { prefix: string; rest: string } {
  const match = /^(\d{2}-\d{3})(?:\s+|$)/.exec(address);
  if (!match) {
    return { prefix: "", rest: address };
  }
  return { prefix: match[1], rest: address.slice(match[0].length).trim() };
}

function insertCommaAfterPlace(address: string, locality: string): string | null {
  const place = locality.replace(/\s+/g, " ").trim();
  if (!place) {
    return null;
  }
  const { prefix, rest } = splitLeadingPostcode(address);
  if (rest.length < place.length) {
    return null;
  }
  if (foldLocality(rest.slice(0, place.length)) !== foldLocality(place)) {
    return null;
  }
  const boundary = rest[place.length] ?? "";
  if (boundary && boundary !== " " && boundary !== ",") {
    return null;
  }
  if (boundary === ",") {
    return address;
  }
  const tail = rest.slice(place.length).trim();
  if (!tail) {
    return address;
  }
  const head = prefix ? `${prefix} ${rest.slice(0, place.length)}` : rest.slice(0, place.length);
  return `${head}, ${tail}`;
}

function insertCommaAfterLocalityHeuristic(address: string): string {
  if (address.includes(",")) {
    return address;
  }
  const { prefix, rest } = splitLeadingPostcode(address);
  if (!prefix) {
    return address;
  }
  const words = rest.split(" ").filter((word) => word.length > 0);
  if (words.length < 2) {
    return address;
  }
  let take = 1;
  const second = foldLocality(words[1] ?? "");
  if (second === "nad" && words.length >= 4) {
    take = 3;
  } else if (LOCALITY_SECOND_WORD.has(second)) {
    take = 2;
  }
  if (take >= words.length) {
    return address;
  }
  return `${prefix} ${words.slice(0, take).join(" ")}, ${words.slice(take).join(" ")}`;
}

/** Ta sama reguła co na mapie. Zapis dalej używa adresu bez przecinka. */
export function addressWithCommaAfterLocality(address: string, locality = ""): string {
  const addr = address.replace(/\s+/g, " ").trim();
  if (!addr) {
    return "";
  }
  const placed = insertCommaAfterPlace(addr, locality);
  if (placed !== null) {
    return placed;
  }
  return insertCommaAfterLocalityHeuristic(addr);
}

/** Widoczny tekst listy. Sam adres, gdy nazwy nie ma albo jest taka sama. Przecinek po miejscowości. */
export function storeAddressLabel(item: StoreAddress): string {
  const shop = item.shop.trim();
  const raw = item.address.trim();
  const address = addressWithCommaAfterLocality(raw);
  if (shop !== "" && shop !== raw && shop !== address) {
    return `${shop} — ${address}`;
  }
  return address;
}

export type RatesTarget = "stawki" | "harmonogram";

type RateBodyInput = {
  shop: string;
  contractor: string;
  pickup: string;
  bag: string;
  from: string;
};

type RateBodyResult = { ok: false; error: "shop" | "date" } | { ok: true; body: Record<string, string> };

function buildRateBody(
  input: RateBodyInput,
  mode: "saveRate" | "saveRateHarmonogram",
  extra?: Record<string, string>,
): RateBodyResult {
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
      mode,
      sklep: shop,
      podwykonawca: contractor,
      kwotaPodjazd: input.pickup,
      kwotaWorek: input.bag,
      odKiedy,
      ...(extra ?? {}),
    },
  };
}

/** Pola `saveRate` jak na mapie. Listy wybiera widok, tu jest tylko body. */
export function saveRateBody(input: RateBodyInput): RateBodyResult {
  return buildRateBody(input, "saveRate");
}

/** Pola `saveRateHarmonogram` jak na mapie (+ dni transportu). */
export function saveRateHarmonogramBody(
  input: RateBodyInput & { days: string },
): RateBodyResult {
  return buildRateBody(input, "saveRateHarmonogram", {
    dniOdbiorow: input.days.trim(),
  });
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
  const folded = foldAddress(query);
  if (folded === "") {
    return [...items];
  }
  return items.filter(
    (item) =>
      foldAddress(item.address).includes(folded) ||
      foldAddress(item.shop).includes(folded) ||
      foldAddress(storeAddressLabel(item)).includes(folded),
  );
}

/** Dokładny adres albo dokładna etykieta, albo jedyne trafienie. Inaczej brak wyboru. */
export function resolveStoreAddress(
  items: readonly StoreAddress[],
  text: string,
): { address: string; query: string } {
  const folded = foldAddress(text);
  if (folded === "") {
    return { address: "", query: "" };
  }
  const exact = items.find(
    (item) => foldAddress(item.address) === folded || foldAddress(storeAddressLabel(item)) === folded,
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
