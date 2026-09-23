# Context: Statystyki rozliczeń

> **Task:** 0010_statystyki (= R8)  
> **Last Updated:** 2026-09-23  
> **Status:** step 4 partial — CP4 ✅; ręczny smoke czeka na wdrożenie `settlementStats`

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
| Odczyt GAS | `settlementStats` + `buildSettlementStats_` (+ `statsRead.test.ts`) ✅ |
| Widok | `rozliczenia/src/statsView.ts` + `statsView.test.ts` ✅ |
| Router / fetch | `range.ts` (`stats` screen), `page.ts` (`runStats`), `readSettlementStats` |
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

## Decyzje implementacyjne (step 2)

| Temat | Decyzja |
|-------|---------|
| Endpoint | GET `settlementStats` tylko (bez POST, bez locka) |
| Query | `dataOd` + `dataDo` wymagane; `podwykonawca` opcjonalny (pusty = wszyscy) |
| Wiersze | rozliczone ∩ zakres; nierozliczone odbyte bez filtra dat; `nie` w R wykluczone |
| Payload wiersza | jak search + `settled`, `happened`, `receptionCost` (P), `costPerBag` (Q) |
| Rates | Baza stawek (filtr podwykonawcy gdy podany); remisy po stronie TS |
| Tryb | brak kolumny → nie ma w payloadzie (TS domyślnie `report`) |

## Decyzje implementacyjne (step 3)

| Temat | Decyzja |
|-------|---------|
| ScreenId | `"range" \| "statement" \| "stats"` |
| Wejście | Przycisk na Zakresie → auto `runStats` (bieżący miesiąc) |
| Fold LS | `rozliczenia.stats.fold.section.*` / `table.*` |
| Stack wykresu | ≥7 bucketów → kolumna + tabela startuje zwinięta |
| Stronicowanie | 5 / stronę: odbiory bez worków + problemy ze stawkami |

## Checkpoint

- **CP1:** `npm test` — 189 pass (2026-09-23) ✅
- **CP1b:** `npm test` — 198 pass, 36 w `stats.test.ts` (2026-09-23) ✅
- **CP2:** `arkusz-mapa` 608 pass + `rozliczenia` 208 pass (`statsRead.test.ts`) (2026-09-23) ✅
- **CP3:** `rozliczenia` 221 pass (UI + `statsView.test.ts`) (2026-09-23) ✅
- **CP4:** `rozliczenia` 221 + `arkusz-mapa` 608 — bez regresji (2026-09-23) ✅

## Otwarte (drobne)

- Top N: stałe **5**.
- „Ostatni kwartał”: poprzedni pełny kwartał (nie 90 dni).
- **Smoke (punkt 4):** żywy Web App **nie** zna `settlementStats` (`unknown action`); `listContractors` OK. Wdrożyć nową wersję istniejącego Web App (ten sam URL; kod już w `transport-log.gs`). Potem lokalnie `?webapp=` albo Pages (workflow → `gh-pages`; Settings Pages powinno czytać `gh-pages`, nie `main`).

### 2026-09-23 — filtry kwartałów jak miesiące
- `quarter` = bieżący kwartał (od 1. dnia Q do dziś)
- `prevQuarter` = lista poprzednich pełnych kwartałów (`yyyy-Qn`)
