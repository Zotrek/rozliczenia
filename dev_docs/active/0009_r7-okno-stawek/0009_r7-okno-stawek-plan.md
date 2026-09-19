# Plan: R7 Okno stawek

> **Task:** 0009_r7-okno-stawek  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R7, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Okno Baza stawek na ekranie Zakres i na Zestawieniu. Nie trzeci ekran.

- Sklep: lista adresów z kolumny Adres sklepu rejestru (`listStoreAddresses`). Nie pinezki mapy, nie kolumna Sklep.
- Podwykonawca: nazwa krótka z Listy podwykonawców. Nie Dane do Worda.
- Oba bez wpisu ręcznego.
- Kwota za podjazd, kwota za worek, od kiedy (`dd.mm.yyyy` albo puste). Te same pola co M4.
- Zapis od razu, istniejące `saveRate` (`mode`, nie druga akcja). Kwota 0 i puste pole przechodzą.
- Kolumny 14–17 się nie zmieniają. Remisu w tym oknie nie ma.
- Po zapisie, gdy jest zestawienie, ponowny odczyt, żeby koszt na ekranie wziął nową stawkę.

## Poza zakresem

Wdrożenie żywego Web App (W1). Rozstrzygnięcie remisu (zostaje na wierszu zestawienia).
