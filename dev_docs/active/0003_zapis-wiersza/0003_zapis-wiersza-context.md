# Context: M3 zapis wiersza

> **Last Updated:** 2026-09-19T21:33:00+02:00  
> **Task:** 0003_zapis-wiersza

## Key files

- `arkusz-mapa/google-apps-script/transport-log.gs` — `ensureTransportRegisterColumns_`, `applyRouteRateToUnsettled_`, `appendTransportRow_`
- `arkusz-mapa/src/transportRow.test.ts` — ten sam skrypt w `vm`, fałszywy arkusz
- `arkusz-mapa/docs/TRANSPORT_SHEET.md` — kolumny 12–18 i pola `trasa`, `stawkaTrasy`

## Decisions

- Nagłówki 12–18 wpisuje tylko dopisanie protokołu. Pusta komórka dostaje tekst. Wypełnionej nie nadpisuje. Kolumny 1–11 nie są w tym zakresie.
- Lista `tak` / `nie` na kolumnie 18 (`setAllowInvalid`, żeby dało się wpisać inną wartość) i przekreślenie wiersza formułą `=$R2="nie"`. Drugi zapis nie dokłada drugiej reguły.
- Klucz `trasa` w body, także pusty, znaczy odbiór z trasy. Bez klucza kolumny 12–13 nowego wiersza zostają puste.
- Stawka idzie na nierozliczone wiersze z tym samym tekstem w kolumnie 12. Pusta nazwa nie rusza innych pustych. `tak` po `trim` i małych literach pomija. Kolumny 16 i 17 nie są zapisywane. Lock jest ten z `doPost`.
- Żywy arkusz zmienia się dopiero w M6.
