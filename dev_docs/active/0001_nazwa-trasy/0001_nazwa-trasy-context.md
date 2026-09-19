# Context: M1 nazwa trasy

> **Last Updated:** 2026-09-19T21:16:00+02:00  
> **Task:** 0001_nazwa-trasy

## Key files

- `arkusz-mapa/src/routeName.ts` — `proposeRouteName`, `routeNameBrowserScript` (`toString`, bez drugiej kopii)
- `arkusz-mapa/src/routeName.test.ts` — te same przypadki na funkcji i na stringu w `vm`
- `arkusz-mapa/src/phase6.ts` — wstrzyknięcie, tylko gdy jest szablon Word

## Decisions

- Data wejściowa: `dd.mm.yyyy`, `dd.mm.rr` albo `yyyy-mm-dd`. W nazwie zawsze `dd.mm.rr`.
- Najmniejszy wolny `nn` od `01` do `99`. Porównanie po przycięciu, bez zmiany wielkości liter.
- Brak listy zajętych nazw, pusta krótka nazwa albo zła data: pusty string.
- Sesja i akcja `routeNameProposal` nie są w tej funkcji. To M2.
