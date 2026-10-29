# Plan: Ewidencja faktur

> **Task:** 0013_ewidencja-faktur  
> **Data:** 2026-10-29  
> **Źródło:** plan „Ewidencja faktur” (sort po dacie zatwierdzenia)

## Zakres

1. Kolumna **Data zatwierdzenia** na końcu rejestru (Na zgłoszenie 22, Harmonogram 21). Zapis przy Zatwierdź, tylko gdy pusta.
2. Miejsce **Ewidencja** w pasku rozliczeń. Lista numerów jak „Ostatnie faktury”, sort od najnowszej daty zatwierdzenia.
3. Filtry okresu i podwykonawcy jak w Statystykach (data odbioru, odczyt `settlementStats`) plus fragment numeru i sposób odbioru. Lejek na kolumnach.
4. Podgląd i edycja jak w Statystykach. Powrót **← Ewidencja** zostawia listę.

## Poza zakresem

- Nowa kolumna na tabeli „Ostatnie faktury” w Statystykach
- Uzupełnianie daty na starych wierszach
- Filtrowanie odczytu po dacie zatwierdzenia (stare faktury zostałyby niewidoczne)
