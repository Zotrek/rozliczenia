# Context: Harmonogram MVP

> **Task:** 0011_harmonogram-mvp  
> **Last Updated:** 2026-09-23  
> **Status:** implemented (MVP)

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Źródło | Tylko arkusz-mapa / ewidencja |
| 2 | Stawki | Osobna zakładka `Baza cen harmonogram` |
| 3 | Worki | Zakładka `odebrane z harmonogramu` |
| 4 | Podjazd bez worków | Tak — każdy dzień z `Dni odbiorów` w zakresie |
| 5 | Zatwierdź | Nie w MVP |
| 6 | Sklep tylko w odebrane | Bez wiersza w Bazie cen → nie wchodzi |

## Pliki

| Warstwa | Ścieżka |
|---------|---------|
| Okno / body | `rozliczenia/src/rateWindow.ts`, `rangeView.ts`, `page.ts` |
| Szukaj | `rozliczenia/src/range.ts` (`tryb`, `searchParams`) |
| Zestawienie | `statementView.ts` (`allowApprove: false`) |
| GAS | `transport-log.gs` — `settlementSearchHarmonogram_`, `buildSettlementHarmonogramRead_` |
| Testy | `rateWindow.test.ts`, `engine.test.ts`, `settlementRead.test.ts` |

## Query Szukaj (Harmonogram)

`action=settlementSearch&podwykonawca=…&dataDo=…&dataOd=…&tryb=harmonogram`
