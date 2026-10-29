# Context: Ewidencja faktur

> **Task:** 0013_ewidencja-faktur  
> **Last Updated:** 2026-10-29  
> **Status:** implemented

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Data faktury | Najwcześniejsza niepusta data zatwierdzenia wierszy tego numeru, firmy i sposobu |
| 2 | Sort listy | Data zatwierdzenia malejąco. Brak daty na końcu, potem numer |
| 3 | Okres na górze | Data odbioru, ten sam `settlementStats` co Statystyki |
| 4 | Harmonogram | Rozliczone wiersze rejestru idą w `scheduleRows`, nie w `rows`. KPI statystyk zostają |
| 5 | Powrót | `workReturn = "ledger"`. Ze Statystyk nadal `"stats"` |
| 6 | Strona | 20 wierszy |

## Pliki

| Obszar | Plik |
|--------|------|
| Arkusz | `arkusz-mapa/google-apps-script/transport-log.gs` |
| Ekran | `rozliczenia/src/ledgerView.ts`, `ledger.ts`, `page.ts`, `rangeView.ts` |
| Spec | `rozliczenia/docs/SPECIFICATION.md`, `arkusz-mapa/docs/TRANSPORT_SHEET.md` |

## Documentation Updates

- [x] Update `-tasks.md` after each subtask completion
- [x] Update `-context.md` if architectural decisions changed
- [x] Update `-plan.md` if requirements changed
- [x] Dopisek w SPEC i TRANSPORT_SHEET
