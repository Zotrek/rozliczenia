# Plan: R6 Zestawienie

> **Task:** 0008_r6-zestawienie  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R6, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Ekran Zestawienie po Szukaj. Kwoty są wynikiem `settle` i `sumSelected`. HTML ich nie liczy drugi raz.

- Wiersz zwykły i wiersz trasy. Jedna nazwa u podwykonawcy w zakresie to jeden wiersz. Gdy dzień nie jest jeden, w dacie jest „—”.
- Rozwinięcie pokazuje sklepy. Liczba worków przy adresie, od razu, `patchBags`.
- „Tylko za liczbę worków” pod nazwą sklepu przy odbiorze zwykłym. Na trasie i w rozwinięciu jej nie ma. Zapis opcji dopiero przy Zatwierdź.
- Kwota za podjazd i kwota za worek zmienione na wierszu zostają na ekranie. Do Bazy stawek nie idą.
- Stawka trasy na zsumowanym wierszu, od razu, `patchRouteRate`.
- Odepnij czyści kolumny 12 i 13 od razu. Nowa trasa: pusta stawka nie zapisuje, kwota 0 zapisuje, nazwa nie jest tą, z której sklep zszedł.
- „Nie odbył się” przekreśla wiersz i wyjmuje go z kosztu przed zapisem. Na arkusz `nie` idzie dopiero przy Zatwierdź. Zdjęcie przed zatwierdzeniem nic nie zapisuje.
- Sumy liczą wiersz trasy raz.
- Zatwierdź woła `approve`. Numer faktury i choć jedno zaznaczenie. Remis nie wchodzi. Trasa nie wchodzi, dopóki remis ma którykolwiek sklep. Rozstrzygnięcie: `resolveRateTie` na wierszu.
- Poniżej 10 000 zł pulsuje logo. Od 10 000 zł jednorożec, co najmniej 3,4 s.
- Po zapisie ponowny `settlementSearch`. Wiersz z `tak` i wiersz z `nie` nie wracają.

## Poza zakresem

Pola okna Baza stawek (R7). Wdrożenie żywego Web App (W1).
