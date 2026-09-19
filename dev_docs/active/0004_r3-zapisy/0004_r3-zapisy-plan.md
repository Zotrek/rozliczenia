# Plan: R3 Zapisy od razu

> **Task:** 0004_r3-zapisy  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R3, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Pięć akcji POST w `arkusz-mapa/google-apps-script/transport-log.gs`, pod tym samym lockiem co protokół.

- `patchBags` — kolumna 9 wskazanego wiersza
- `patchRouteRate` — stawka po tekście nazwy, na nierozliczone
- `detachRoute` — czyści kolumny 12 i 13 jednego wiersza
- `attachRoute` — nowa nazwa i stawka, potem ta sama reguła co `patchRouteRate`
- `resolveRateTie` — Baza stawek, nie rejestr

Zapis rejestru niesie numer wiersza i numer z kolumny 1. Pod lockiem odpada, gdy para się nie zgadza. Kolumn 16 i 17 te akcje nie ruszają. `saveRate` nie powstaje drugi raz.

## Poza zakresem

`approve` (R4), ekran (R5–R7), wdrożenie na żywy arkusz (W1).
