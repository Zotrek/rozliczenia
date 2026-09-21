# PLAN.md — Kolejność prac

> **Status:** Zatwierdzony 2026-09-19. Etap 0 zamknięty. M1–M6 zamknięte. W1: sekretu zapisu nie ma, nowa wersja Web App jeszcze nie weszła.  
> **Ostatnia aktualizacja:** 2026-09-19  
> **Reguły:** [`SPECIFICATION.md`](SPECIFICATION.md). Ten plik ich nie powtarza.  
> **Kontrakt techniczny:** [`ARCHITECTURE.md`](ARCHITECTURE.md). Stos, kolumny, akcje, klucz wiersza, gdzie leży kod.

Dwie ścieżki. Między nimi można iść równolegle po etapie 0. Wewnątrz ścieżki etap czeka na to, od czego zależy.

Zapis pliku `.gs` w repozytorium nie zmienia żywej mapy. Żywy zapis mapy jest dopiero po M6. Żywy zapis akcji rozliczeń jest dopiero po W1. To dwa wdrożenia tego samego Web App, ten sam URL.

---

## Etapy

| Etap | Ścieżka | Co powstaje | Zależy od | Gotowe, gdy |
|------|---------|-------------|-----------|-------------|
| 0 | obie | Checklista architektury. Pliki `logo.png` i `jednorozec-deba.gif` w `rozliczenia/` | — | Oba pliki są. Checklista architektury zaznaczona |
| M1 | mapa | `arkusz-mapa/src/routeName.ts` | 0 | Testy niżej. Jedna funkcja, bez drugiej kopii reguł |
| M2 | mapa | Okno protokołu w `phase6.ts` | M1 | Testy niżej. `docs/pusty.docx` nietknięty. `npm test` w arkusz-mapa przechodzi |
| M3 | mapa | Zapis kolumn 12–13 w `transport-log.gs`, nagłówki, lista, przekreślenie | 0 | Testy niżej. `TRANSPORT_SHEET.md` opisuje kolumny 12–18 |
| M4 | mapa | Trzecia zakładka panelu i akcja `saveRate` | 0 | Testy niżej |
| M5 | mapa | Ostatnia data pomija kolumnę 18 = `nie` | 0 | Testy niżej. `npm test` w arkusz-mapa przechodzi |
| M6 | mapa | Wdrożenie | M2, M3, M4, M5 | Nowa wersja Web App, ten sam URL. Potem workflow Pages mapy, żeby okno z M2 weszło na stronę. Katalog `rozliczenia/` nie wchodzi do `site/` |
| R1 | rozliczenia | Silnik kosztów w `rozliczenia/src/` | 0 | Przykłady ze specyfikacji, lista niżej. Daty `dd.mm.yyyy` |
| R2 | rozliczenia | Sam odczyt: `settlementSearch`, `listContractors` | 0 | Nic nie zapisuje. Każdy wiersz niesie numer wiersza i numer z kolumny 1 |
| R3 | rozliczenia | Zapisy od razu: worki, stawka trasy, odepnij, nowa trasa, `resolveRateTie` | R2 | Zapisy rejestru niosą parę klucza i odpadają, gdy się nie zgadza. Kolumn 16 i 17 nie ruszają. `saveRate` nie powstaje tu drugi raz |
| R4 | rozliczenia | Samo `approve` | R2 | Reguły z architektury. Nie oznacza wiersza spoza zaznaczenia. Na żywy arkusz wchodzi w W1, nie w M6 |
| W1 | rozliczenia | Wdrożenie akcji rozliczeń | R4 | Nowa wersja Web App, ten sam URL. M6 tego nie robi. Przed krokiem wiadomo, czy jest sekret |
| R5 | rozliczenia | Ekran Zakres | R1, R2 | Filtr niżej |
| R6 | rozliczenia | Zestawienie, edycje, sumy, Zatwierdź | R1, R3, R4, R5 | Lista niżej. Logo i jednorożec z etapu 0 |
| R7 | rozliczenia | Okno Baza stawek | M4, R6 | Listy: adres z rejestru, nazwa krótka z Listy podwykonawców. Te same pola i `saveRate` co M4 |

M1 można pisać razem z R1. M5 nie czeka na M2. M4 jest jedynym miejscem, w którym powstaje `saveRate`. R7 go woła.

---

## Mapa

### M1. Nazwa trasy

Funkcja dostaje listę zajętych nazw, krótką nazwę podwykonawcy i datę odbioru. Zwraca propozycję albo pusty string.

- `nazwaPodwykonawcy-dd.mm.rr-nn`. Nazwa krótka, nie Dane do Worda. Data z protokołu jako `dd.mm.rr`, nie `dd.mm.yyyy` z kolumny 5.
- Najmniejszy wolny `nn` od `01` do `99`. Zajęte `01` daje `02`. Brak wolnego: pusto.
- Do HTML wchodzi ta sama funkcja, wstrzyknięta jak `referenceFormatsBrowserScript`. Test karmi te same przypadki funkcję i string w przeglądarce. Dwie rozjechane kopie nie przechodzą.

Pamięć sesji nie jest w tej funkcji. Sesja jest w M2, bo żyje w otwartej stronie.

`routeNameProposal` w skrypcie tylko czyta kolumnę 12 i oddaje zajęte nazwy. Propozycję liczy funkcja, nie skrypt.

### M2. Okno protokołu

W `#doc-modal`, obok obecnych pól. Zapis dopiero przy generowaniu Word, tym samym POST co dziś.

- Checkbox wyłączony: pola schowane, body bez trasy.
- Samo zaznaczenie nic nie zapisuje.
- Ostatnia nazwa to zmienna strony. Odświeżenie czyści. Nie `localStorage`, nie ostatni wiersz kolumny Trasa. W tej samej sesji kolejny protokół dostaje tę nazwę bez podbijania numeru.
- Użytkownik może wpisać inną nazwę, także już istniejącą. Po udanym zapisie ona staje się ostatnią w sesji.
- Po nazwie, która już jest, stawka przychodzi z `routeRateByName`.
- Pusta stawka przy zaznaczonej trasie zapisuje protokół. Kolumna 13 zostaje pusta, udział wynosi 0 zł. Kwota 0 też się zapisuje. To nie blokuje Worda. Pusta stawka nie zapisuje tylko nowej trasy po odpięciu.
- Zbiorczo: jedno okno, jedna nazwa, jedna stawka. Każdy sklep i tak ma własny wiersz i własny numer.
- `arkusz-mapa/docs/pusty.docx` bez zmian. Pola trasy nie wchodzą do dokumentu Word.

### M3. Zapis wiersza

`appendTransportRow_` dziś kończy `appendRow` na komentarzu 2.

1. Przed dopisaniem jakiegokolwiek wiersza protokołu, także bez trasy, wpisuje nagłówki 12–18, jeśli komórki są puste. To tekst nagłówka, nie pusta komórka. Kolumn 1–11 nie rusza. Aplikacja rozliczeń tych nagłówków nie wpisuje.
2. W tym samym kroku, raz: lista `tak` / `nie` na kolumnie 18 i przekreślenie wiersza z `nie`. Przekreślenie jest regułą formatowania arkusza, nie klasą w przeglądarce. `nie` wpisuje aplikacja i też ręka w arkuszu. Dopóki tego kroku nie było, kolumny 18 nie ma i brak kolumny znaczy, że transport się odbył.
3. Body z trasą dopisuje 12 i 13. Body bez trasy ich nie wypełnia.
4. Nowa stawka idzie od razu na pozostałe nierozliczone wiersze z tym samym tekstem w kolumnie 12, bez filtra podwykonawcy i dat. Rozliczone pomija. Kolumn 16 i 17 nie rusza. Lock jak przy numerze protokołu.
5. `arkusz-mapa/docs/TRANSPORT_SHEET.md` dostaje kolumny 12–18 i nowe pola body.

### M4. Baza stawek na mapie

Trzecia zakładka w `buildMapManualAdmin.ts`. Zapis od razu, `text/plain`, nie czeka na `npm run generate`.

Adres z listy pinezek już obecnych na mapie. Podwykonawca z nazw krótkich Listy podwykonawców. Oba bez wpisu ręcznego. Stawki trasy w tym panelu nie ma.

`saveRate`: jeden wiersz klucza nadpisuje kwoty, dwa i więcej odmawia, inna data dopisuje wiersz. Kwota 0 i puste pole kwoty są dozwolone. Usuwania nie ma. Kolumn 14–17 nie rusza. Brak zakładki: ten zapis ją zakłada.

### M5. Worki, gdy transport się nie odbył

`buildBulkLastTransportDatesMap_` i `findLastTransportInfo_` dziś biorą zakres do kolumny 6. Wiersz z kolumną 18 = `nie` jest pomijany: nie ustawia daty odcięcia i nie jest ostatnim odbiorem w popupie. Inna wartość niż `nie`, także pusta, dalej odcina. Brak kolumny 18 znaczy to samo co pusta.

### M6. Wdrożenie mapy

Kod M3–M5 w repozytorium jeszcze nic nie zmienia w arkuszu. Trzeba nowe wdrożenie Web App (wykonaj jako ja). URL w `TRANSPORT_WEBAPP_URL` zostaje, jeśli wdraża się nową wersję istniejącego wdrożenia, nie drugie wdrożenie obok.

Okno z M2 wchodzi na stronę dopiero, gdy przejdzie workflow `arkusz-mapa-pages.yml`. Ten workflow publikuje `site/` i zastępuje całą gałąź `gh-pages`. Nie kopiować tam `rozliczenia/`.

---

## Rozliczenia

`package.json` z typescript i vitest, w wersjach jak arkusz-mapa, powstaje na początku R1. Wcześniej zależności nie dokładamy. Strona buduje się lokalnie do jednego HTML, który woła silnik. Publikacja: własne repozytorium, workflow wkłada sekret `TRANSPORT_WEBAPP_URL` do `index.html` i wystawia gałąź `gh-pages`.

### R1. Silnik

Testy biorą przykłady ze specyfikacji:

- podjazd 20 zł + worki 10 zł = koszt 30 zł,
- trasa 150 zł i dwa sklepy: udział 75 zł, suma trasy to stawka raz plus worki,
- 100 / 3 = 33,33 zł, suma udziałów 99,99 zł,
- tylko worki: 10 zł, w Podjazd/Trasa jest „—”,
- stawka 150 zł, trzy sklepy, jeden „nie odbył się”: dzielnik 2, udział 75 zł, wyłączony 0 zł,
- żaden sklep się nie odbył: kosztu trasy nie ma, nie dzielimy przez 1,
- brak pary, pusta stawka worka albo 0: 0 zł, bez błędu,
- remis stawek: błąd, nie 0 zł,
- przedziały z tabeli stawek w specyfikacji (puste, 10.09.2026, 10.10.2026),
- koszt per worek przy pustej ilości albo 0 dzieli przez 1,
- data odbioru i data w Bazie stawek to tekst `dd.mm.yyyy`.

### R2. Odczyt

Tylko `settlementSearch` i `listContractors`. Żadnego zapisu.

Wiersz z Rozliczony `tak` i wiersz z transport `nie` nie wracają. Każdy zwrócony wiersz ma numer wiersza arkusza i numer z kolumny 1.

### R3. Zapisy od razu

`patchBags`, `patchRouteRate`, `detachRoute`, `attachRoute`, `resolveRateTie`.

Każdy zapis rejestru niesie numer wiersza i numer z kolumny 1. Pod lockiem odpada, gdy w tym wierszu kolumna 1 jest inna. `patchRouteRate` idzie po tekście nazwy, nie po podwykonawcy i nie po dacie. `attachRoute` nie zapisuje pustej stawki. Kwota 0 zapisuje. Kolumn 16 i 17 te akcje nie ruszają. `resolveRateTie` zostawia wskazany wiersz stawki i usuwa pozostałe z tą samą parą i datą. To nie jest zapis rejestru.

### R4. Zatwierdzenie

Osobno od R3, bo dopiero tu powstają kolumny 14–17.

Payload niesie numer faktury, zaznaczone wiersze (para klucza) i stan ekranu, którego arkusz nie pamięta: tylko worki, transport się nie odbył, kwoty podjazdu i worka zmienione na zestawieniu, koszt już policzony.

Skrypt odmawia bez numeru faktury i bez zaznaczenia. Wiersz z remisem pomija, pozostałe zaznaczone może zapisać. Sklep z „nie odbył się” dostaje samo `nie` w kolumnie 18. Odbyty dostaje `tak`, fakturę, kolumny 16 i 17. Wiersz trasy rozpisuje na sklepy. Niezaznaczone zostają. Wiersz, który w międzyczasie ma `tak`, jest pomijany. Para klucza, która się nie zgadza, jest pomijana.

Na żywy arkusz ta akcja wchodzi dopiero w W1, nie w M6. Sekretu zapisu nie ma: patrz W1. Dostęp zostaje „każdy”.

### R5. Zakres

- Na zgłoszenie włączone. Harmonogram widać i nie da się go zaznaczyć.
- Podwykonawca z listy, zawężanie po Nazwa albo Dane do Worda. Tekstu spoza listy nie da się wybrać. Bez wyboru Szukaj nie startuje.
- Data końcowa wymagana. Data początkowa późniejsza niż końcowa pokazuje błąd i nie startuje. Opcja bez daty początkowej czyści datę i przywraca ostatnią po zdjęciu.
- Obie granice włącznie. Ten sam dzień w obu polach to ten jeden dzień.
- Zmień zakres wraca na ten ekran. Baza stawek otwiera okno, nie trzeci ekran. Samo okno jest w R7.

### R6. Zestawienie

Kwoty na ekranie są wynikiem R1, nie drugim liczeniem w HTML.

- Wiersz zwykły i wiersz trasy. Jedna nazwa u tego podwykonawcy w zakresie to jeden wiersz, także gdy dni się różnią. Gdy dzień nie jest jeden, w dacie jest „—”.
- Rozwinięcie pokazuje sklepy. Liczbę worków zmienia się przy adresie, od razu, akcją z R3, do kolumny 9 tego wiersza.
- „Tylko za liczbę worków” stoi pod nazwą sklepu przy odbiorze zwykłym. Na trasie i w rozwinięciu jej nie ma. Włączona: w Podjazd/Trasa jest „—”. Zapis tej opcji dopiero przy Zatwierdź.
- Kwota za podjazd i kwota za worek zmienione na wierszu zostają na ekranie. Do Bazy stawek nie idą.
- Stawka trasy na zsumowanym wierszu zapisuje się od razu, akcją z R3.
- Odepnij czyści kolumny 12 i 13 tego sklepu od razu. Sklep zostaje odbiorem zwykłym. Nowa trasa: pusta stawka nie zapisuje, kwota 0 zapisuje, nazwa nie jest tą, z której sklep właśnie zszedł.
- „Nie odbył się” przekreśla wiersz i wyjmuje go z kosztu jeszcze przed zapisem. Na arkusz `nie` idzie dopiero przy Zatwierdź wiersza, który go obejmuje. Zdjęcie przed zatwierdzeniem nic nie zapisuje.
- Suma zestawienia i suma zaznaczonych liczą wiersz trasy raz, bez sklepów z rozwinięcia.
- Zatwierdź woła R4. Chce numeru faktury i choć jednego zaznaczenia. Wiersz z remisem nie wchodzi. Trasa nie wchodzi, dopóki remis ma którykolwiek sklep z rozwinięcia. Pozostałe zaznaczone da się zatwierdzić. Rozstrzygnięcie jest na tym wierszu, akcją `resolveRateTie` z R3, nie w oknie Baza stawek i nie czeka na R7.
- Poniżej 10 000 zł pulsuje logo. Od 10 000 zł jest jednorożec, co najmniej dwa cykle, dłużej gdy zapis trwa dłużej. Poniżej progu jednorożca nie ma.
- Po zapisie wiersz z `tak` i wiersz z `nie` nie wracają w następnym wyszukaniu.

### R7. Okno stawek

Sposób wyboru jest zaznaczony w architekturze: listy, bez wpisu ręcznego. Adres z kolumny Adres sklepu rejestru. Podwykonawca to nazwa krótka z Listy podwykonawców. Nie pinezki mapy.

Te same pola i ta sama akcja `saveRate` co M4. Kolumny 14–17 się nie zmieniają. Remis nie jest w tym oknie.

### W1. Wdrożenie akcji rozliczeń

Sekret zapisu: **nie ma**. Ustalenie z 2026-09-19, przed wgraniem `approve`.

Żywy Web App odpowiada na `listContractors` i `settlementSearch` bez tokenu. `doPost` sekretu nie sprawdza. Mapa go nie wysyła. `TRANSPORT_WEBAPP_URL` to adres, nie klucz. Dostęp zostaje „wykonaj jako ja, każdy”. Konta użytkownika nie dokładamy.

Nowa wersja **istniejącego** wdrożenia, ten sam URL. Nie drugie wdrożenie obok. M6 tego nie robi: plik w repozytorium ma już `approve`, żywy skrypt z M6 go nie ma.

---

## Poza kolejką

- Harmonogram. Checkbox jest w R5, reguł nie ma.
- Cofanie rozliczenia i zmiana numeru faktury po zatwierdzeniu.
- Wykresy.
- Zmiana szablonu Word.
- Ostrzeżenie, gdy ta sama nazwa trasy albo drugie Zatwierdź dzieli stawkę jeszcze raz. Specyfikacja tego nie blokuje. Test w R1 pokazuje, że dzielnik liczy sklepy widoczne w zestawieniu, nie że system odmawia.
- Własny workflow Actions publikuje Pages z sekretu `TRANSPORT_WEBAPP_URL`. Adres nie leży na `main`.
- Folder zadań w `dev_docs/`. Powstaje przy kodowaniu etapu, nie teraz.

---

## Zatwierdzenie

- [x] Kolejność z tabeli: M1–M6, R1–R7 i W1
- [x] R2 nic nie zapisuje, R4 jest jedynym zatwierdzeniem. Okno stawek: listy (adres z rejestru, nazwa krótka), nie pinezki mapy
- [x] M6 jest warunkiem żywej mapy. W1 jest warunkiem żywych akcji rozliczeń. Sam commit `.gs` nie wystarcza
- [x] Po M2 i po M5 przechodzi `npm test` w arkusz-mapa

**Zatwierdzający:** zotrek  
**Data:** 2026-09-19
