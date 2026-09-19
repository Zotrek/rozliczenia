# Plan: R2 Odczyt

> **Task:** 0002_r2-odczyt  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R2, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Dwie akcje w `arkusz-mapa/google-apps-script/transport-log.gs`. Żadnego zapisu, żadnego locka, żadnego zakładania zakładki.

- `listContractors` — GET. Ta sama scalona lista co `listReferenceData.podwykoLista`: `nazwa` i `dane`.
- `settlementSearch` — GET albo POST. Podwykonawca (nazwa krótka), data do, data od albo brak.

Wiersz z Rozliczony `tak` i wiersz z transport `nie` nie wracają. Brak kolumny 18 znaczy, że transport się odbył. Każdy wiersz rejestru niesie numer wiersza arkusza i tekst kolumny 1. Stawki tego podwykonawcy wracają z numerem wiersza, bo remis ma tę samą parę i datę. Kwoty w groszach. Daty tekstem `dd.mm.yyyy`.

## Poza zakresem

Zapisy (R3, R4), ekran (R5–R7), wdrożenie Web App (W1).
