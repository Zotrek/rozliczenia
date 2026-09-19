# Context: R3 Zapisy od razu

> **Task:** 0004_r3-zapisy  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Jedna kopia reguł, w `transport-log.gs`. Test w `rozliczenia` odpala `doPost` na fałszywym arkuszu. Drugiej funkcji w TypeScript nie ma.
- Para klucza: `sheetRow` i `transportNumber`. Porównanie idzie przez `settlementTransportNumber_`, więc liczba `15` w komórce zgadza się z tekstem `"15"`.
- Rozliczony `tak` (trim, bez względu na wielkość liter) odrzuca cały zapis rejestru. Stawka nie idzie wtedy na inne wiersze.
- `patchRouteRate` woła istniejące `applyRouteRateToUnsettled_`. Pusta stawka czyści kolumnę 13. Kwota 0 zostaje. Filtra podwykonawcy i daty nie ma.
- `attachRoute` przy pustej stawce albo pustej nazwie nie zapisuje nic, także nazwy. Kwota 0 zapisuje, potem ta sama propagacja.
- `resolveRateTie` bierze `sheetRow` zakładki Baza stawek. Usuwa od dołu wiersze z tą samą parą i datą, także gdy data jest pusta. Złej daty nie rusza. Zakładki nie zakłada. Rejestru nie czyta.
- Nagłówków rejestru te akcje nie wpisują. Kolumn 16 i 17 nie ma w zakresach zapisu.
- Żywy arkusz zmienia się dopiero w W1.

## API

Wszystko POST, `text/plain`, pod lockiem. Sukces: `{ ok: true }`.

| Akcja | Body | Błąd |
|-------|------|------|
| `patchBags` | `sheetRow`, `transportNumber`, `iloscWorkow` | `key`, `settled`, `bags` |
| `patchRouteRate` | `sheetRow`, `transportNumber`, `trasa`, `stawkaTrasy` | `key`, `settled`, `name`, `rate` |
| `detachRoute` | `sheetRow`, `transportNumber` | `key`, `settled` |
| `attachRoute` | `sheetRow`, `transportNumber`, `trasa`, `stawkaTrasy` | `key`, `settled`, `name`, `rate` |
| `resolveRateTie` | `sheetRow` wiersza Bazy stawek | `key` |

Puste `iloscWorkow` czyści kolumnę 9. Zero zostaje zerem. Ujemne i nieliczba to `bags`.

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 77 testów, pass (2026-09-19)
- **Regresja:** `npm test` w `arkusz-mapa/` — 461 testów, pass (2026-09-19)
