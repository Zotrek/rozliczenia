# Tasks: R3 Zapisy od razu

> **Task:** 0004_r3-zapisy  
> **Updated:** 2026-09-19

## Implementation

- [x] `patchBags` — kolumna 9, para klucza, zero zostaje, puste czyści
- [x] `patchRouteRate` — po tekście nazwy, bez filtra podwykonawcy i dat. Rozliczone pomija
- [x] `detachRoute` — czyści kolumny 12 i 13 jednego wiersza, reszty trasy nie rusza
- [x] `attachRoute` — pusta stawka nie zapisuje, kwota 0 zapisuje, potem ta sama reguła co stawka
- [x] `resolveRateTie` — zostawia wskazany wiersz stawki, usuwa pozostałe z tą samą parą i datą. To nie jest zapis rejestru
- [x] Zapis rejestru odpada, gdy kolumna 1 się nie zgadza. Kolumn 16 i 17 nie rusza. `saveRate` nie powstaje drugi raz
- [x] **CHECKPOINT 1:** `npm test` w `rozliczenia/` — 77 testów, pass ✅ (2026-09-19)

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` (kontrakt zapisu)
- [x] `-plan.md` — zakres R3 bez zmiany wymagań
