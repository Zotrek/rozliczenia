/** Kwota w groszach. 30 zł = 3000. Silnik nie liczy na float. */
export type Grosze = number;

/**
 * Wiersz rejestru już zawężony do zakresu.
 * Kwoty wchodzą w groszach. Daty są tekstem `dd.mm.yyyy`, nie ISO.
 */
export interface RegisterRow {
  /** Numer wiersza arkusza. Nagłówek jest w 1, dane od 2. */
  sheetRow: number;
  /** Kolumna 1. */
  transportNumber: string;
  /** Kolumna 2. Adres sklepu — klucz stawki, nie kolumna Sklep. */
  address: string;
  /** Kolumna 4. */
  shopName: string;
  /** Kolumna 5. Tekst `dd.mm.yyyy`. */
  pickupDate: string;
  /** Kolumna 6. Nazwa krótka. */
  contractor: string;
  /** Kolumna 9. Pusta = null. Zero zostaje zerem. */
  bagCount: number | null;
  /** Kolumna 12. Pusta = odbiór zwykły. */
  routeName: string;
  /** Kolumna 13. Grosze. Pusta = null. Zero zostaje zerem. */
  routeRate: Grosze | null;
}

/** Wiersz Bazy stawek. Kwoty w groszach. Data tekstem `dd.mm.yyyy` albo pusta. */
export interface RateRow {
  /** Adres sklepu, ta sama wartość co kolumna 2 rejestru. */
  shop: string;
  /** Nazwa krótka, ta sama wartość co kolumna 6 rejestru. */
  contractor: string;
  /** Grosze. null = puste pole. */
  pickupAmount: Grosze | null;
  /** Grosze. null = puste pole. */
  bagAmount: Grosze | null;
  /** `dd.mm.yyyy` albo `""` = od zawsze. */
  validFrom: string;
}

/**
 * Stan, którego arkusz nie pamięta.
 * Brak klucza = odbiór odbyty, ze stawką z bazy, z podjazdem.
 */
export interface ScreenState {
  bagsOnly?: boolean;
  didNotHappen?: boolean;
  /** undefined = stawka z bazy. null = puste pole na ekranie. */
  pickupAmount?: Grosze | null;
  /** undefined = stawka z bazy. null = puste pole na ekranie. */
  bagAmount?: Grosze | null;
}

export interface EngineInput {
  rows: readonly RegisterRow[];
  rates: readonly RateRow[];
  /** Klucz z `rowKey`. */
  screenByRow: Readonly<Record<string, ScreenState>>;
}

export interface RateCandidate {
  /** Indeks w `rates` tego wywołania. */
  index: number;
  validFrom: string;
  pickupAmount: Grosze | null;
  bagAmount: Grosze | null;
}

/** Remis: dwa albo więcej wierszy tej samej pary i tej samej daty, która miałaby obowiązywać. */
export interface RateTie {
  shop: string;
  contractor: string;
  validFrom: string;
  candidates: RateCandidate[];
}

export interface ShopCost {
  sheetRow: number;
  transportNumber: string;
  address: string;
  shopName: string;
  pickupDate: string;
  bagCount: number | null;
  happened: boolean;
  bagsOnly: boolean;
  /**
   * Kwota w Podjazd/Trasa.
   * null = „—” (tylko worki, albo remis przy odbiorze zwykłym).
   */
  legAmount: Grosze | null;
  /** null = pusta stawka albo remis. Zero jest zerem. */
  bagRate: Grosze | null;
  /** null = remis, opłaty za worki z tej pary nie ma. */
  bagSum: Grosze | null;
  /**
   * Koszt odbioru tego sklepu.
   * null = remis, kosztu z pary na ekranie nie ma.
   * Transport, który się nie odbył: 0. Kolumny 16 i 17 i tak zostają puste — patrz `costPerBag`.
   */
  receptionCost: Grosze | null;
  /**
   * Kolumna 17: koszt / ilość worków. Pusta ilość albo 0 dzieli przez 1.
   * null = nie zapisujemy (remis albo transport się nie odbył).
   */
  costPerBag: Grosze | null;
  tie: RateTie | null;
}

export interface PlainLine {
  kind: "plain";
  shop: ShopCost;
}

export interface RouteLine {
  kind: "route";
  routeName: string;
  /** null = „—”, gdy dzień odbioru nie jest jeden. */
  date: string | null;
  /** Stawka z kolumny 13. null = pusta. */
  routeRate: Grosze | null;
  /**
   * false, gdy żaden sklep się nie odbył.
   * Kosztu trasy wtedy nie ma i stawki nie dzielimy przez 1.
   */
  routeCostApplies: boolean;
  /** Suma ilości worków sklepów, które się odbyły. */
  bagCount: number;
  /** null = „—”, gdy odbyty adres nie ma jednej wspólnej kwoty albo jest remis. */
  bagRate: Grosze | null;
  bagSum: Grosze | null;
  /**
   * Stawka trasy raz plus worki sklepów, które się odbyły.
   * null, gdy worków nie da się policzyć (remis).
   * 0, gdy kosztu trasy nie ma.
   */
  routeSum: Grosze | null;
  shops: ShopCost[];
}

export type StatementLine = PlainLine | RouteLine;

export interface Statement {
  lines: StatementLine[];
  /**
   * Suma wierszy tabeli. Trasa raz, bez sklepów z rozwinięcia.
   * Remis dokłada 0, bo kwoty nie ma — nie dlatego, że koszt wynosi 0. Remis jest w `ties`.
   */
  total: Grosze;
  ties: RateTie[];
}
