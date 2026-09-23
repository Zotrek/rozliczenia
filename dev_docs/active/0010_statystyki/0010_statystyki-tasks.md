# Tasks: Statystyki rozliczeń

> **Task:** 0010_statystyki  
> **Updated:** 2026-09-23 (step 2 GAS done)

## 0. Makieta (zrobione)

- [x] Makieta ekranu Statystyki + filtry okresu / KPI / Q / luki
- [x] Przycisk **Statystyki** na Zakresie i **← Powrót** na Statystykach
- [x] Spięcie w `makiety-tabeli.html` (link do makiety statystyk)
- [x] Usunięcie bloku udziału kosztów Na zgłoszenie vs Harmonogram
- [x] Makieta: blok **Worki w czasie** (słupki + tabela, 2 serie trybu)
- [x] Makieta: podgląd gęstych danych (ostatni kwartał, ~13 tygodni)
- [x] Makieta: **koszty w czasie**; top Q bez poziomych słupków; **bez** backlog vs rozliczone
- [x] Makieta: zwijanie sekcji + auto-zwinięta tabela przy długim okresie + `localStorage`
- [x] Makieta: **Podwykonawcy** najdrożsi/najtańsi (per sklep P + per worek Q; bez I = 0)
- [x] Makieta: **Podjazdy bez worków** (lista I = 0)
- [x] Makieta: stronicowanie **5 wierszy / stronę** (podjazdy bez worków + luki w stawkach)
- [x] Makieta: pulsujące logo przy ładowaniu danych (nakładka jak w rozliczeniach)

## 1. Okres i agregacje (TDD, pure TS)

- [x] Funkcje zakresu dat: bieżący miesiąc, miesiąc kalendarzowy, poprzedni kwartał, exact od–do
- [x] Agregacje: backlog (count + estimate), rozliczone (count + suma P), średnia Q, top 5 drogie/tanie z adresem sklepu
- [x] Agregacje KPI: liczba odbiorów w okresie + unikalne sklepy (adres)
- [x] Agregacja luk: puste L/M na nierozliczonych + remisy Bazy stawek
- [x] **CHECKPOINT 1:** `npm test` w `rozliczenia/` — 189 pass (27 nowych w `stats.test.ts`) ✅
- [x] Agregacja **Worki w czasie** + **Koszty w czasie** (buckety tydzień/miesiąc ≤45 dni, split trybu)
- [x] Agregacja **ranking podwykonawców** (śr. P per sklep, śr. Q per worek; bags > 0) + **lista I = 0**
- [x] **CHECKPOINT 1b:** `npm test` — 198 pass (36 w `stats.test.ts`) ✅

## 2. Odczyt GAS

- [x] GET action (np. `settlementStats`): odczyt wierszy rejestru pod filtry (bez zapisu, bez locka)
- [x] W payloadzie: pola potrzebne do P/Q/I, statusu, daty, podwykonawcy, adresu, snapshotów; dane do remisów stawek; tryb gdy będzie w rejestrze
- [x] Testy / smoke jak przy innych GET w `arkusz-mapa` (nie psuć `settlementSearch` / `saveRate`)
- [x] **CHECKPOINT 2:** `npm test` w `arkusz-mapa/` — 608 pass; `rozliczenia/` — 208 pass (10 w `statsRead.test.ts`) ✅

## 3. UI ekranu Statystyki

- [ ] Stan / router: Zakres ↔ Statystyki (Powrót, przycisk na Zakresie)
- [ ] Filtry: chipy okresu, miesiąc, exact, podwykonawca, Pokaż
- [ ] KPI + tabele Q/luki/podwykonawcy/0 worków + Worki/Koszty w czasie; zwijanie sekcji/tabel + localStorage
- [ ] **CHECKPOINT 3:** `npm test` w `rozliczenia/` — pełny suite pass

## 4. Domknięcie

- [ ] Ręczny smoke na Pages / lokalnym HTML z Web App (gdy action wdrożony)
- [ ] **CHECKPOINT 4 (regresja):** `npm test` w `rozliczenia/` + `arkusz-mapa/` — brak regresji

## Poza checklistą (nie robić)

- Raport po fakturze
- Sklepy bez odbiorów 2 tyg. / miesiąc
- Osobny blok udziału kosztów Na zgłoszenie vs Harmonogram
- Chart.js / inne biblioteki wykresów
- Prognoza / trend na przyszłe tygodnie
- Blok Backlog vs rozliczone (paski)

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` (ścieżki `stats.ts` / decyzje agregacji step 1)
- [x] Update scope: Worki w czasie × tryb (2026-09-23)
- [x] SPEC § Statystyki + ARCH (3 widoki, `settlementStats`) + PLAN R8 (2026-09-23)
- [x] Copy UI w makiecie i 0010 wyrównane do języka zarządu