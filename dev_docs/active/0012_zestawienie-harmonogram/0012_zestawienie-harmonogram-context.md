# Context: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Last Updated:** 2026-10-26 (Szukaj: zapis stawek pod lockiem, ponowny odczyt wiersza)  
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
| 19 | Szukaj vs baza cen | Szukaj zapisuje stawkę podjazdu i worka z Bazy cen tylko na wierszach tego zestawienia (podwykonawca + zakres). Datę bierze tak jak sync zestawienia: najpóźniejsza nie późniejsza niż odbiór. Pusta data w Bazie cen to „od zawsze” i jest starsza niż każda wpisana. Para, której każda data jest późniejsza niż odbiór, jest tym samym co brak pary (czyszczone kolumny 12 i 13). Remis „tak jak sync” dotyczy całego wyboru daty, nie tylko dwóch wierszy z jedną datą: zostaje pierwszy wiersz w kolejności zakładki. Trasy nie rusza. Rozliczonych i `transport się odbył = nie` nie rusza. Zapis tych dwóch kolumn bierze lock skryptu i tuż przed zapisem sprawdza wiersz jeszcze raz: rozliczony, transport `nie` albo inny adres, data lub podwykonawca zostają bez zapisu. Sync mapki bez zmian i nadal przepisuje też trasę |
| 20 | Stawka z ręki przy Zatwierdź | Stawka podjazdu i worka, z których policzył się koszt, zapisuje się w kolumnach tego zatwierdzanego wiersza. Przy trasie sam worek. Baza cen i inne podjazdy zostają. Stawka za trasę bez zmian. Zamkniętych faktur apka nie poprawia wstecz |
| 21 | Ilość worków na rozliczonym | Edycja Ilość worków w arkuszu na wierszu `Rozliczony=tak` przelicza Koszt odbioru i koszt na worek od razu. Udział podjazdu albo trasy zostaje. Zostają **Rozliczony**, numer faktury i kolumny stawek. Sync mapki tego nie robi |

## Pliki

| Warstwa | Ścieżka |
|---------|---------|
| GAS | `arkusz-mapa/google-apps-script/transport-log.gs` |
| Testy GAS | `arkusz-mapa/src/settlementRead.test.ts`, `settlementWrites.test.ts` |
| UI | `rozliczenia/src/rangeView.ts`, `statement.ts`, `page.ts` |
| Docs | `arkusz-mapa/docs/TRANSPORT_SHEET.md` |
