# Tasks: R6 Zestawienie

> **Task:** 0008_r6-zestawienie  
> **Updated:** 2026-09-19

## Implementation

- [x] Wiersz zwykły i wiersz trasy. Jedna nazwa to jeden wiersz. Gdy dzień nie jest jeden, w dacie jest „—”
- [x] Rozwinięcie: sklepy, liczba worków przy adresie, zapis od razu `patchBags`
- [x] „Tylko za liczbę worków” pod nazwą sklepu. Na trasie i w rozwinięciu jej nie ma. Włączona: w Podjazd/Trasa jest „—”
- [x] Kwota za podjazd i kwota za worek zostają na ekranie. Do Bazy stawek nie idą
- [x] Stawka trasy zapisuje się od razu, `patchRouteRate`
- [x] Odepnij czyści trasę od razu. Nowa trasa: pusta stawka nie zapisuje, 0 zapisuje, nazwa nie jest tą, z której sklep zszedł
- [x] „Nie odbył się” przekreśla i wyjmuje z kosztu przed zapisem. Zdjęcie nic nie zapisuje. `nie` dopiero przy Zatwierdź
- [x] Suma zestawienia i suma zaznaczonych liczą trasę raz
- [x] Zatwierdź woła `approve`. Faktura i zaznaczenie. Remis nie wchodzi. Rozstrzygnięcie na wierszu, `resolveRateTie`
- [x] Poniżej 10 000 zł logo. Od 10 000 zł jednorożec, co najmniej dwa cykle
- [x] Po zapisie ponowne wyszukanie. Wiersz z `tak` i wiersz z `nie` nie wracają
- [x] **CHECKPOINT 1:** `npm test` w `rozliczenia/` — 145 testów, pass ✅ (2026-09-19)

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` (ekran Zestawienie, zapisy, jednorożec)
- [x] `-plan.md` — zakres R6 bez zmiany wymagań
