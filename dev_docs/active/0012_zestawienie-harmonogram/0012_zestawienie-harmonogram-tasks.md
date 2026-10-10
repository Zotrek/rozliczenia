# Tasks: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Updated:** 2026-10-01

## Implementation

- [x] Docs 0012 (plan/context/tasks)
- [x] GAS: zakładka, nagłówki, `syncZestawienieHarmonogram_`
- [x] GAS: `settlementSearch` tryb harmonogram czyta zestawienie
- [x] GAS: approve / patchBags z `tryb=harmonogram`
- [x] rozliczenia: allowApprove + `tryb` w body zapisów
- [x] Sync zestawienia w pipeline po „odebrane” (`syncZestawienieHarmonogram` w phase7)
- [x] Testy + TRANSPORT_SHEET.md / harmonogram-github-actions.md
- [x] **CHECKPOINT:** vitest arkusz-mapa (sync + phase7) + rozliczenia
- [x] `saveRateHarmonogram` → od razu stawki na nierozliczonych wierszach zestawienia (+ reload UI Harmonogram)
- [x] Przy 0 workach uzupełniać Nazwa kontrahenta / Nazwa punktu z odebrane (ten sam adres)
- [x] **CHECKPOINT:** `npm test` arkusz-mapa (syncZestawienieHarmonogram + settlementRead) — all pass ✅

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` if decisions change
- [x] TRANSPORT_SHEET.md — lista zakładek
