# Context: R7 Okno stawek

> **Task:** 0009_r7-okno-stawek  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Adresy nie są w `settlementSearch`: okno otwiera się przed Szukaj i bierze całą kolumnę 2, nie zakres jednego podwykonawcy. Stąd GET `listStoreAddresses`. Odczyt, bez locka, bez zakładania zakładek.
- Zapis to ten sam POST `mode: saveRate` co trzecia zakładka mapy. W `rozliczenia/` nie ma drugiej implementacji reguł klucza.
- Po udanym zapisie kwoty i data się czyszczą, sklep i podwykonawca zostają. Na zestawieniu `adoptRows` bierze nowe stawki i zostawia stan ekranu (worki-only, nie odbył się, nadpisane kwoty wiersza).
- Remis wraca jako odmowa zapisu. Wskazania wiersza w oknie nie ma.

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 155 testów, pass (2026-09-19)
- **CP1 mapa:** `npm test` w `arkusz-mapa/` — 472 testów, pass (2026-09-19). Skrypt `listStoreAddresses_` nie rozjechał `saveRate`.

## API strony

- Body i odczyt listy: `src/rateWindow.ts`. `resolveRate` zostaje w `src/rates.ts`
- Okno: `src/rangeView.ts`
- Podpięcie: `src/page.ts`
- Odczyt adresów: `listStoreAddresses_` w `transport-log.gs`
