# Context: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Last Updated:** 2026-10-21 (sync zdejmuje nierozliczone wiersze spoza dni odbioru)  
> **Status:** implemented

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Zakładka | `zestawienie z harmonogramu` (osobna od `odebrane z harmonogramu`) |
| 2 | Ilość worków | Suma jak kolumna I w Arkusz1 (nie lista plomb) |
| 3 | Podjazd bez worków | Tak — dzień z Bazy cen bez worków → wiersz z 0 |
| 4 | Sklep tylko w odebrane | Trafia do zestawienia (stawki puste) |
| 5 | Sync vs rozliczony | `Rozliczony=tak` — sync pomija wiersz |
| 6 | Okno sync | Domyślnie: 1. bieżącego miesiąca → dziś |
| 7 | Zatwierdź | Tak — jak Arkusz1; body z `tryb=harmonogram` |
| 8 | Kiedy sync | Pipeline `COPY_ODEBRANE_Z_HARMONOGRAMU=1` (phase7): po odebrane + Baza cen |
| 9 | Nr zlecenia | Brak w zestawieniu — klucz zapisu = `sheetRow` + `tryb=harmonogram` |
| 10 | Rodzaj zbiórki | Z `Tryb zbiórki` na workach (agregacja jak w protokole) |
| 11 | transport się odbył | Zawsze lista tak/nie + przekreślenie przy „nie” |
| 12 | Sync vs clear | Sync tylko uzupełnia / aktualizuje nierozliczone; **nigdy nie czyści** zakładki |
| 13 | Zapis stawek → zestawienie | `saveRateHarmonogram` po sukcesie dopisuje stawki/trasę na nierozliczonych wierszach tej pary (bez czekania na pipeline) |
| 14 | Ilość worków vs usunięcie z odebrane | Sync przy update bierze **max(istniejąca, z odebrane)** — usunięcie pojedynczych worków z „odebrane” **nie cofa** sumy w zestawieniu |
| 15 | Nazwy przy 0 workach | `Nazwa kontrahenta` i `Nazwa punktu` z worków dnia; gdy 0 worków — z dowolnego wiersza `odebrane` tego adresu |
| 16 | Lag sync +1 dzień | Wiersz do zestawienia dopiero **dzień po** dacie odbioru (teoretycznej z Bazy / zamknięcia worka): 01.10 → dopisanie gdy sync z `dataDo` ≥ 02.10; kolumna Data odbioru = 01.10 |
| 17 | Worki poza dniem odbioru | Sklep z dniami w Bazie cen: wiersz tylko w te dni. Worek zamknięty w inny dzień dolicza się do najbliższego takiego odbioru (data zamknięcia, jeśli wpada w dni; inaczej kolejny). Osobnego wiersza na ten dzień nie ma. Sklep bez dni w Bazie zostaje na dacie zamknięcia. |
| 18 | Stare wiersze spoza dni | Sync nie czyści całej zakładki. Nierozliczony wiersz spoza dni Bazy oddaje worki na najbliższy dzień odbioru i jest usuwany. Zostaje, gdy sam jest rozliczony, ma numer faktury, albo dzień docelowy jest rozliczony. „transport się odbył = nie” jest usuwany bez doliczania worków. Liczba na dniu odbioru to max(zapis z odebrane, suma już w arkuszu + worki z błędnych dni), żeby nie podwoić worków nadal obecnych w odebrane. |

## Pliki

| Warstwa | Ścieżka |
|---------|---------|
| GAS | `arkusz-mapa/google-apps-script/transport-log.gs` |
| Testy GAS | `arkusz-mapa/src/settlementRead.test.ts`, `settlementWrites.test.ts` |
| UI | `rozliczenia/src/rangeView.ts`, `statement.ts`, `page.ts` |
| Docs | `arkusz-mapa/docs/TRANSPORT_SHEET.md` |
