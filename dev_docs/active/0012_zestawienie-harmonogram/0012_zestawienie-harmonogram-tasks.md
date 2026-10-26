# Tasks: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Updated:** 2026-10-26

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
- [x] Worki spoza dnia odbioru doliczają się do najbliższego dnia z Bazy cen
- [x] Sync zdejmuje nierozliczone wiersze spoza tych dni (worki przechodzą na dzień odbioru)
- [x] **CHECKPOINT:** vitest syncZestawienieHarmonogram + settlementRead — planOffScheduleCleanup ✅

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` if decisions change
- [x] TRANSPORT_SHEET.md — lista zakładek

## Reguły 2026-10-26

- [x] Specyfikacja, architektura, TRANSPORT_SHEET, decyzje 19–21
- [x] Szukaj: zapis kolumn 12 i 13 tylko na wierszach tego zestawienia
- [x] Szukaj: brak pary i same daty późniejsze niż odbiór czyszczą 12 i 13
- [x] Szukaj: pusta data w Bazie cen jest najstarsza
- [x] Szukaj: remis tej samej daty zostawia pierwszy wiersz
- [x] Szukaj: transport `nie` i `Rozliczony` `tak` bez zapisu
- [x] Szukaj: zapis 12 i 13 pod lockiem, ponowny odczyt pomija zamknięty albo przesunięty wiersz
- [x] Szukaj: kolumny 10 i 11 nietknięte
- [x] `resolveHarmonogramSnapshot_` nadal pomija pustą datę
- [x] **CHECKPOINT 1:** `npm test` arkusz-mapa — settlementRead + syncZestawienieHarmonogram ✅
- [x] Zatwierdź: odbiór zwykły wpisuje obie stawki z body
- [x] Zatwierdź: trasa tylko stawkę worka, Baza cen zostaje
- [x] Zatwierdź: brak klucza nic nie zapisuje
- [x] Zatwierdź: pusta wartość czyści tę kolumnę i wiersz dostaje `tak`
- [x] `buildApprove` dokłada obie stawki tylko przy `tryb=harmonogram`
- [x] Wiersz z `nie` dostaje samo `nie` w kolumnie 9
- [x] **CHECKPOINT 2:** odczyt + sync arkusz-mapa oraz `buildApprove` w rozliczeniach ✅
- [x] Ilość worków na rozliczonym: koszt bez opłaty za worki plus nowa liczba × stawka worka
- [x] Pusta albo zerowa stawka worka zostawia koszt i przelicza tylko koszt na worek
- [x] Pusta liczba albo 0 dzieli przez 1; kolumny 12, 13, 14 i 15 zostają
- [x] Nierozliczony wiersz i Na zgłoszenie dostają samą nową liczbę
- [x] **CHECKPOINT 3:** `npm test` arkusz-mapa (982) i rozliczenia (308) ✅
