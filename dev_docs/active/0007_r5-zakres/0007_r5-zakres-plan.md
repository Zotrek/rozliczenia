# Plan: R5 Ekran Zakres

> **Task:** 0007_r5-zakres  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R5, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Ekran Zakres na jednej stronie HTML. Reguły filtra są czystymi funkcjami w `src/range.ts`. Ta sama kopia wchodzi do `index.html`.

- Na zgłoszenie włączone. Harmonogram widać i nie da się go zaznaczyć.
- Podwykonawca z listy `listContractors`. Zawężanie po Nazwa albo Dane do Worda. Tekstu spoza listy nie da się wybrać. Bez wyboru Szukaj nie startuje.
- Data końcowa wymagana. Data początkowa późniejsza niż końcowa pokazuje błąd i nie startuje. Opcja bez daty początkowej czyści datę i przywraca ostatnią po zdjęciu.
- Obie granice włącznie, jako tekst `dd.mm.yyyy`. Ten sam dzień w obu polach to ten jeden dzień. Porównanie wierszy zostaje w `buildSettlementRead_`, bez drugiej kopii filtra.
- Po Szukaj drugi ekran. Zmień zakres wraca na kartę. Baza stawek otwiera okno na bieżącym ekranie.

## Poza zakresem

Tabela zestawienia (R6). Pola i zapis okna Baza stawek (R7). Wdrożenie (W1).
