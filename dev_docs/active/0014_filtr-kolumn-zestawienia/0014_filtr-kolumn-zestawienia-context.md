# Context: Filtr kolumn zestawienia

> **Task:** 0014_filtr-kolumn-zestawienia  
> **Last Updated:** 2026-10-29  
> **Status:** documented

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Lejek | Na każdej kolumnie zestawienia ten sam co przy odbiorach w Statystykach i przy Ewidencji: lista wartości, szukanie, sortowanie, OK, wyczyść jedną kolumnę, wyczyść wszystko |
| 2 | Zapis | Filtr i sort są stanem przeglądarki. Do arkusza nie schodzą |
| 3 | Podjazd | Zostaje, gdy jego komórki pasują do wszystkich włączonych filtrów |
| 4 | Trasa | Zostaje, gdy pasuje wiersz trasy albo któryś jej sklep. Po rozwinięciu widać sklepy spełniające filtr. Filtr „trasa” pokazuje całą trasę |
| 5 | Pusta komórka | Na liście filtra „—” |
| 6 | Licznik | Gdy filtr coś chowa: „N z M pozycji w zestawieniu”. Bez filtra sam licznik pozycji |
| 7 | Sumy | Suma zestawienia i suma zaznaczonych liczą całe rozliczenie, także wiersze schowane filtrem |
| 8 | Zaznacz wszystkie | Przy włączonym filtrze zaznacza tylko widoczne pozycje. Zaznaczenie schowanych wierszy zostaje |
| 9 | Tryby | Ten sam lejek na zestawieniu Na zgłoszenie i Harmonogram |

## Pliki

| Obszar | Plik |
|--------|------|
| Ekran | `rozliczenia/src/statementTable.ts`, `statementView.ts`, `page.ts` |
| Spec | `rozliczenia/docs/SPECIFICATION.md` |
| Architektura | `rozliczenia/docs/ARCHITECTURE.md`, `PLAN.md` |

## Documentation Updates

- [x] Update `-tasks.md` after each subtask completion
- [x] Update `-context.md` if architectural decisions changed
- [x] Update `-plan.md` if requirements changed
- [x] Dopisek w SPEC, ARCHITECTURE i PLAN
