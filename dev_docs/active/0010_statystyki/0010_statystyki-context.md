# Context: Statystyki rozliczeń

> **Task:** 0010_statystyki (= R8)  
> **Last Updated:** 2026-09-23  
> **Status:** step 1 complete (okres + wszystkie agregacje pure TS); GAS / UI pending

## Decyzje produktowe (2026-09-23)

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Okres domyślny | **Bieżący miesiąc** (1. → dziś) |
| 2 | Metryka worka | **Koszt odbioru per worek** (kol. 17 / Q) |
| 3 | Po fakturze | **Nie** |
| 4 | Sklepy bez odbiorów | **Nie** |
| 5 | Udział kosztów po trybie (KPI) | **Nie**; wyjątek: serie czasowe worki/koszty |
| 6 | Makieta | `docs/makiety-statystyki.html` — copy pod zarząd |
| 7 | Nawigacja | Zakres → Statystyki; ← Powrót → Zakres |
| 8 | Wizualizacja | Słupki CSS; rankingi jako tabele; bez Chart.js |
| 9 | Prognoza/trend | **Nie** |
| 10 | Zwijanie UI | Sekcje zwijane; tabela pod wykresem startuje zwinięta; `localStorage` |
| 11 | Ranking podwykonawców | Średni koszt odbioru (na sklep) + średni koszt za worek; bez zera worków |
| 12 | Odbiory bez worków | Lista w okresie; **5 na stronę** |
| 13 | Problemy ze stawkami | Tabela; **5 na stronę** |
| 14 | Ładowanie | Pulsujące logo + „Ładuję dane…” |

## Nazwy UI (makieta / SPEC) ↔ techniczne

| UI (zarząd) | Technicznie |
|-------------|-------------|
| Do rozliczenia | backlog nierozliczonych |
| Problemy ze stawkami | luki: puste snapshoty L/M + remisy Bazy |
| Odbiory bez worków | happened ∧ I = 0 |
| Koszt za worek | kol. Q |
| Koszt odbioru | kol. P |
| W przeliczeniu na sklep / na worek | śr. P / śr. Q per podwykonawca |

## Źródło trybu (serie czasowe)

- W rejestrze **nie ma jeszcze** kolumny Na zgłoszenie / Harmonogram.
- Do czasu: wszystko w serii Na zgłoszenie; Harmonogram = 0.

## Kolumny rejestru (istotne)

| Kol. | Litera | Pole | Użycie |
|------|--------|------|--------|
| 2 | B | Adres sklepu | rankingi, problemy |
| 4 | D | Sklep | etykieta |
| 5 | E | Data odbioru | filtry okresu |
| 6 | F | Kto odbiera | filtr / grupowanie |
| 9 | I | Ilość worków | serie worków; wykluczenie I = 0 z rankingów |
| 12–13 | L–M | Snapshot stawek | problemy |
| 14 | N | Rozliczony | rozliczone vs do rozliczenia |
| 16 | P | Koszt odbioru | sumy, ranking na sklep |
| 17 | Q | Koszt odbioru per worek | średnia, rankingi |
| 18 | R | transport się odbył | pomijać `nie` |

## Pliki kluczowe

| Warstwa | Ścieżka |
|---------|---------|
| Makieta | `rozliczenia/docs/makiety-statystyki.html` |
| SPEC / ARCH / PLAN | § Statystyki; Frontend 3 widoki; etap R8 |
| Agregacje TS | `rozliczenia/src/stats.ts` + `stats.test.ts` ✅ |
| Widok | `rozliczenia/src/statsView.ts` (planowany) |
| GAS | `settlementStats` w `transport-log.gs` |

## Decyzje implementacyjne (step 1)

| Temat | Decyzja |
|-------|---------|
| Zegar okresu | `today: CalendarDate` wstrzykiwane |
| Backlog / problemy | Bez filtra okresu; okres dla settled/Q/odbiorów/sklepów/serii/I=0 |
| Średnia Q / rankingi | settled + happened + bags > 0 + Q ≠ null |
| Serie czasowe | ≤45 dni włącznie → tygodnie (pon–niedz, clip do filtra); dłużej → miesiące |
| Tryb w serii | `StatsRow.mode`; brak = `report` (Na zgłoszenie) |
| Ranking podwykonawców | śr. P i śr. Q; bags > 0; top 5 |
| Odbiory I = 0 | `bagCount === 0` (null nie wchodzi); w okresie |

## Checkpoint

- **CP1:** `npm test` — 189 pass (2026-09-23) ✅
- **CP1b:** `npm test` — 198 pass, 36 w `stats.test.ts` (2026-09-23) ✅

## Otwarte (drobne)

- Top N: stałe **5**.
- „Ostatni kwartał”: poprzedni pełny kwartał (nie 90 dni).
