# Context: M2 okno protokołu

> **Last Updated:** 2026-09-19T21:26:00+02:00  
> **Task:** 0002_okno-protokolu

## Key files

- `arkusz-mapa/src/routeProtocol.ts` — body POST, nazwa z sesji albo propozycji, stawka z odczytu. Bez `localStorage` i bez pamięci sesji
- `arkusz-mapa/src/phase6.ts` — `#doc-modal`, zmienna `lastRouteName`, ten sam payload w jednym i w zbiorczym
- `arkusz-mapa/google-apps-script/transport-log.gs` — GET `routeNameProposal` i `routeRateByName`. `appendRow` nadal kończy się na komentarzu 2

## Decisions

- Sesja to `lastRouteName` w skrypcie strony. Odświeżenie czyści. Nie `localStorage`, nie ostatni wiersz kolumny Trasa.
- Nazwa krótka to `label` z listy, nie Dane do Worda. Data to pole daty załadunku (`yyyy-mm-dd`), funkcja z M1 zamienia ją na `dd.mm.rr`.
- Checkbox wyłączony: `routeBodyFields` zwraca `null`, kluczy `trasa` i `stawkaTrasy` nie ma. Zaznaczony: oba klucze, także przy pustej stawce i przy `0`. Worda to nie blokuje.
- Po udanym POST ta nazwa zostaje ostatnią. Samo zaznaczenie nic nie zapisuje. Wpis użytkownika, także istniejąca nazwa, wygrywa z propozycją.
- Stawka istniejącej nazwy przychodzi z `routeRateByName`. Pusta, gdy nazwy nie było wśród nierozliczonych. Rozliczony `tak` jest pomijany. Ostatni pasujący wiersz wygrywa.
- Zbiorczo: jedno okno, `form.routeFields` na każdy sklep. Każdy sklep ma własny POST i własny numer.
- `doc.render` nie dostaje pól trasy. `pusty.docx` bez zmian.
- Zapis kolumn 12–13 w `appendTransportRow_` jest w M3. Do tego czasu body już niesie pola, a skrypt ich nie zapisuje.
