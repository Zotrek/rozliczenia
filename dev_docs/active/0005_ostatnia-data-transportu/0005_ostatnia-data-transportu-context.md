# Context: M5 ostatnia data transportu

> **Last Updated:** 2026-09-19T21:43:00+02:00  
> **Task:** 0005_ostatnia-data-transportu

## Key files

- `arkusz-mapa/google-apps-script/transport-log.gs` — `readTransportPickupRows_`, `transportDidNotHappen_`, obie funkcje ostatniej daty
- `arkusz-mapa/src/lastTransport.test.ts` — ten sam skrypt w `vm`, fałszywy arkusz
- `arkusz-mapa/docs/TRANSPORT_SHEET.md` — popup i filtr plomb

## Decisions

- Zakres od kolumny 2 do 18. Indeksy adresu, podmiotu, daty i „kto odbiera” bez zmian.
- Pomija tylko tekst `nie` po `trim` i małych literach. `tak`, inny tekst, spacje i pusta komórka odcinają worki.
- Krótszy wiersz (brak kolumny 18) jest jak pusta komórka.
- Przy tej samej dacie dalej wygrywa późniejszy wiersz, o ile to nie `nie`.
- Żywy arkusz i strona mapy zmieniają się dopiero w M6.
