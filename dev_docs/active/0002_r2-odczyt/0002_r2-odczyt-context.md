# Context: R2 Odczyt

> **Task:** 0002_r2-odczyt  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Jedna kopia reguł filtra, w bloku `settlement-read-pure` w `transport-log.gs`. Test w `rozliczenia` wczytuje ten blok i karmi go przypadkami. Drugiej funkcji w TypeScript nie ma.
- `listContractors` nie czyta samej zakładki Lista podwykonawców. Bierze `mergeReferencePodwykoLista_()`, bo na mapie widać też stare Przewoźnicy i Miejsca dostawy.
- Porównanie podwykonawcy jest dokładne po trimie, bez składania wielkości liter. `tak` i `nie` są po trimie i bez względu na wielkość liter.
- Data w odpowiedzi jest zawsze `dd.mm.yyyy`. ISO w komórce odpada z tego wiersza, reszta wyszukania zostaje. Obiekt daty z arkusza idzie składnikami lokalnymi.
- Stawka bez daty (`validFrom: ""`) zostaje. Zła data stawki odpada z listy stawek, nie z całego odczytu.
- Brak zakładki Baza stawek to `rates: []`. Odczyt jej nie zakłada.
- `settlementSearch` jest obsługiwane przed lockiem. Zły JSON też wraca bez locka.

## API

`GET ?action=listContractors` → `{ ok: true, data: [{ nazwa, dane }] }`

`GET` albo `POST { action: "settlementSearch", podwykonawca, dataDo, dataOd? }`

Sukces: `{ ok: true, rows: RegisterRow[], rates: SettlementRateRow[] }`.  
Błąd zapytania: `{ ok: false, error }` i żadnych wierszy. Teksty: `podwykonawca required`, `dataDo required`, `dataOd is not dd.mm.yyyy`, `dataDo is not dd.mm.yyyy`, `dataOd after dataDo`.

Typy odpowiedzi: `rozliczenia/src/search.ts`.

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 60 testów, pass (2026-09-19)
