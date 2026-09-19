# Tasks: R1 Silnik kosztów

> **Task:** 0001_r1-silnik  
> **Updated:** 2026-09-19

## Implementation

- [x] `package.json` z typescript i vitest w wersjach jak arkusz-mapa
- [x] Daty `dd.mm.yyyy`, porównanie kalendarzowe
- [x] Przedziały stawek: puste, 10.09.2026, 10.10.2026
- [x] Podjazd 20 zł + worki 10 zł = 30 zł
- [x] Trasa 150 zł, dwa sklepy: udział 75 zł, suma trasy = stawka raz + worki
- [x] 100 / 3 = 33,33 zł, suma udziałów 99,99 zł
- [x] Tylko worki: 10 zł, Podjazd/Trasa puste
- [x] Trzy sklepy, jeden „nie odbył się”: dzielnik 2, udział 75 zł, wyłączony 0 zł
- [x] Żaden sklep się nie odbył: kosztu trasy nie ma
- [x] Brak pary, pusta stawka worka albo 0: 0 zł, bez błędu
- [x] Remis: błąd, nie 0 zł
- [x] Koszt per worek: pusta ilość albo 0 dzieli przez 1
- [x] **CHECKPOINT 1:** `npm test` — 38 testów, pass ✅ (2026-09-19)

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` (grosze, daty, API)
- [x] `-plan.md` — zakres R1 bez zmiany wymagań
