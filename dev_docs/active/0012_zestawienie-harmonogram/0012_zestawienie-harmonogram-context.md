# Context: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Last Updated:** 2026-11-05 (zapis stawek po końcu ceny, nadwyżka przy rozliczonym, dni okresu przy zapisie z mapy)  
> **Status:** implemented

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Zakładka | `zestawienie z harmonogramu` (osobna od `odebrane z harmonogramu`) |
| 2 | Ilość worków | Suma jak kolumna I w Arkusz1 (nie lista plomb) |
| 3 | Podjazd bez worków | Tak — dzień z Bazy cen bez worków → wiersz z 0 |
| 4 | Sklep tylko w odebrane | Trafia do zestawienia (stawki puste) |
| 5 | Sync vs rozliczony | `Rozliczony=tak` zostaje (stawki, faktura, status). Worki z odebrane ponad sumę rozliczonych dopisują drugi, nierozliczony wiersz z samą różnicą. Gdy obok jest już otwarty wiersz, rośnie tylko on. Ręczny sync z arkusza robi to samo. „transport się odbył = nie” też zostaje i nie przyjmuje worków: idą na otwarty wiersz obok albo dopisują nowy |
| 6 | Okno sync | Domyślnie wcześniejsza z dat: 1. dzień miesiąca albo dziś − 7, oraz najwcześniejsze zamknięcie worka wpadające na odbiór z ostatnich 7 dni — także 1.–7. dnia miesiąca. Ręczny sync z arkusza używa tego samego okna |
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
| 17 | Worki poza dniem odbioru | Dni biorą się z okresu ceny obowiązującego w tym dniu (najpóźniejsza „od kiedy” nie późniejsza niż dzień), nie z pierwszego wiersza pary. Gdy cena się skończyła i nic jej nie zastąpiło, dni ostatniego okresu zostają, a stawki na istniejącym wierszu są czyszczone. Pusta stawka przy okresie, który jeszcze obowiązuje, albo brak pary w bazie, nie ściera stawki wpisanej ręcznie. Ręczny sync tak samo. Sklep z dniami w tym okresie: wiersz tylko w te dni. Worek zamknięty w inny dzień dolicza się do najbliższego takiego odbioru, także gdy po drodze dni się zmienią. Osobnego wiersza na dzień zamknięcia nie ma. Okres bez dni zostaje na dacie zamknięcia. Sync Bazy cen i zapis stawki z mapy nie przepisują dni na inne okresy, gdy wiersze tej pary mają już różne dni — nowy zapis trafia tylko w wiersz tego okresu |
| 18 | Stare wiersze spoza dni | Sync nie czyści całej zakładki. Nierozliczony wiersz spoza dni Bazy oddaje worki na najbliższy dzień odbioru i jest usuwany. Zostaje, gdy sam jest rozliczony albo ma numer faktury. Gdy dzień odbioru jest rozliczony i plan ma nadwyżkę, surowy wiersz schodzi, a wiersz obok dostaje różnicę z odebranych — nie większą liczbę worków z surowego wiersza. Gdy nadwyżki nie ma, surowy wiersz też schodzi, bez dopisywania worków, żeby Szukaj nie policzył ich drugi raz. „transport się odbył = nie” jest usuwany bez doliczania worków i tuż przed zapisem nie przyjmuje worków. Na otwartym dniu odbioru liczba to max(zapis z odebrane, suma już w arkuszu + worki z błędnych dni). Cel to otwarty wiersz pary, nie ostatni rozliczony. Ręczny sync robi to samo. |
| 19 | Szukaj vs baza cen | Szukaj zapisuje stawkę podjazdu i worka z Bazy cen tylko na wierszach tego zestawienia (podwykonawca + zakres). Datę bierze tak jak sync zestawienia: najpóźniejsza nie późniejsza niż odbiór. Pusta data w Bazie cen to „od zawsze” i jest starsza niż każda wpisana. Para, której każda data jest późniejsza niż odbiór, jest tym samym co brak pary (czyszczone kolumny 12 i 13). Remis „tak jak sync” dotyczy całego wyboru daty, nie tylko dwóch wierszy z jedną datą: zostaje pierwszy wiersz w kolejności zakładki. Trasy nie rusza. Rozliczonych i `transport się odbył = nie` nie rusza. Zapis tych dwóch kolumn bierze lock skryptu i tuż przed zapisem sprawdza wiersz jeszcze raz: rozliczony, transport `nie` albo inny adres, data lub podwykonawca zostają bez zapisu. Sync mapki bez zmian i nadal przepisuje też trasę |
| 20 | Stawka z ręki przy Zatwierdź | Stawka podjazdu i worka, z których policzył się koszt, zapisuje się w kolumnach tego zatwierdzanego wiersza. Przy trasie sam worek. Baza cen i inne podjazdy zostają. Stawka za trasę bez zmian. Zamkniętych faktur apka nie poprawia wstecz |
| 21 | Ilość worków na rozliczonym | Edycja Ilość worków w arkuszu na wierszu `Rozliczony=tak` przelicza Koszt odbioru i koszt na worek od razu. Udział podjazdu albo trasy zostaje. Zostają **Rozliczony**, numer faktury i kolumny stawek. Sync mapki tego wiersza nie przepisuje — nadwyżkę dopisuje obok (decyzja 5) |

## Pliki

| Warstwa | Ścieżka |
|---------|---------|
| GAS | `arkusz-mapa/google-apps-script/transport-log.gs` |
| Testy GAS | `arkusz-mapa/src/settlementRead.test.ts`, `settlementWrites.test.ts` |
| UI | `rozliczenia/src/rangeView.ts`, `statement.ts`, `page.ts` |
| Docs | `arkusz-mapa/docs/TRANSPORT_SHEET.md` |
