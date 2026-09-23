# Plan: Statystyki rozliczeń

> **Task:** 0010_statystyki (= etap **R8** w [`docs/PLAN.md`](../../../docs/PLAN.md))  
> **Źródło:** ustalenia produktowe 2026-09-23 + makieta [`docs/makiety-statystyki.html`](../../../docs/makiety-statystyki.html)  
> **Reguły bazowe:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md) (§ Statystyki), [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md), rejestr [`arkusz-mapa/docs/TRANSPORT_SHEET.md`](../../../../arkusz-mapa/docs/TRANSPORT_SHEET.md)

## Cel

Trzeci widok w aplikacji Rozliczenia: odczytowe KPI, tabele i proste słupki CSS z rejestru (`Arkusz1` + Baza stawek). Bez zatwierdzania, bez edycji kosztów, bez bibliotek wykresów (Chart.js itd.). Teksty UI — język zarządu (bez liter kolumn arkusza).

## Zakres MVP

### Nawigacja

- Ekran **Zakres**: przycisk **Statystyki** obok Bazy stawek (wejście bez Szukaj).
- Ekran **Statystyki**: przycisk **← Powrót** wraca do Zakresu.
- Makieta referencyjna: `docs/makiety-statystyki.html` (+ spięcie w `docs/makiety-tabeli.html`).

### Filtry okresu

| Opcja | Zachowanie |
|-------|------------|
| **Bieżący miesiąc** (domyślnie) | od 1. dnia bieżącego miesiąca do dziś (włącznie) |
| **Poprzednie miesiące** | wybór pełnego miesiąca kalendarzowego z listy |
| **Ostatni kwartał** | pełny poprzedni kwartał kalendarzowy |
| **Dokładny zakres** | od–do (włącznie), jak na Zakresie |

Dodatkowo: **podwykonawca** (wszyscy / jeden). Przycisk **Pokaż raport**.

### Bloki raportów

1. **Do rozliczenia** — liczba nierozliczonych + szacunkowa suma PLN (silnik kosztów jak w zestawieniu; tylko zrealizowane).
2. **Liczba odbiorów** — w okresie: zrealizowane wiersze rejestru (każdy sklep osobno; także nierozliczone).
3. **Obsłużone sklepy** — w okresie: liczba różnych adresów wśród tych odbiorów.
4. **Rozliczone w okresie** — liczba + łącznie **koszt odbioru**.
5. **Średni koszt za worek** — średnia z **koszt odbioru per worek**; tylko rozliczone, zrealizowane, z workami.
6. **Koszt w przeliczeniu na worek** — 5 najdroższych / 5 najtańszych sklepów; tabela; tylko z workami.
7. **Podwykonawcy — kto jest droższy, kto tańszy** — dwie metryki, top 5 każda:
   - **W przeliczeniu na sklep:** średni koszt odbioru na podwykonawcę.
   - **W przeliczeniu na worek:** średni koszt za worek na podwykonawcę.
   - Tylko rozliczone, zrealizowane, **z workami** (odbiory z zerem worków wykluczone).
   - Pełny sens przy filtrze „Wszyscy”.
8. **Odbiory bez worków** — zrealizowane w okresie, ilość worków = 0 (także nierozliczone); **5 pozycji na stronę**.
9. **Ile worków zabrano w czasie** — suma worków w okresach; rozdział Na zgłoszenie / Harmonogram; tabela + słupki CSS.
10. **Ile zapłacono w czasie** — suma kosztów rozliczonych w tych samych okresach; ten sam rozdział; tabela + słupki CSS.
11. **Problemy ze stawkami** — nierozliczone bez stawki albo konflikt (kilka stawek w bazie); **5 pozycji na stronę**.

Granulacja okresów (worki + koszty): **tydzień** przy okresie ≤ ~45 dni, **miesiąc** przy dłuższym.

### Backend (GAS)

- GET `settlementStats` w `transport-log.gs` (bez zapisu).
- Bez nowej bazy / nowego pliku Sheets.

### Frontend

- Ten sam stos: TypeScript → jeden `index.html`, style z makiety.
- Nowy widok / stan strony.
- Pure funkcje agregacji + Vitest (TDD).
- Zwijanie sekcji; `localStorage`; tabela pod wykresem startuje zwinięta przy długim okresie.
- Pulsujące logo przy ładowaniu (jak przy Szukaj).

## Poza zakresem

- Raport po numerze faktury; sklepy bez odbiorów; prognoza.
- Osobny blok udziału kosztów po trybie (wyjątek: serie czasowe).
- Blok „backlog vs rozliczone” jako wykres; Chart.js.
- Cofanie rozliczenia / edycja FV; Vue / Symfony / PostgreSQL.

## Kryteria akceptacji

- Z Zakresu da się wejść w Statystyki i wrócić.
- Domyślny okres = bieżący miesiąc; pozostałe tryby działają.
- Rankingi kosztu za worek i podwykonawców bez odbiorów z zerem worków.
- Lista odbiorów bez worków + problemy ze stawkami (stronicowanie 5).
- Serie czasowe (tabela + słupki); pulsujące logo przy odczycie.
- `npm test` w `rozliczenia/` przechodzi; zmiany w `transport-log.gs` nie psują testów mapy.
