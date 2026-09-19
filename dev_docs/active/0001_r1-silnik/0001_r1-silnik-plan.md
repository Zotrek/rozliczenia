# Plan: R1 Silnik kosztów

> **Task:** 0001_r1-silnik  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R1, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Czyste funkcje w `rozliczenia/src/`. Bez arkusza, bez DOM, bez zapisu.

Wejście: wiersze rejestru w zakresie, wiersze Bazy stawek, stan ekranu (tylko worki, nie odbył się, nadpisane stawki).  
Wyjście: wiersze tabeli (zwykły albo trasa), kwoty w groszach, sumy, lista remisów.

Testy biorą przykłady ze specyfikacji wymienione w R1. Daty zostają tekstem `dd.mm.yyyy`.

## Poza zakresem

Odczyt i zapis arkusza (R2–R4), ekran (R5–R7), `saveRate`.
