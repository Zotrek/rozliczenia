# Context: M4 baza stawek na mapie

> **Last Updated:** 2026-09-19T21:35:00+02:00  
> **Task:** 0004_baza-stawek-mapa

## Key files

- `arkusz-mapa/src/buildMapManualAdmin.ts` — trzecia zakładka, POST `mode: 'saveRate'`
- `arkusz-mapa/src/saveRate.ts` — jedna treść reguł klucza i kwoty
- `arkusz-mapa/google-apps-script/transport-log.gs` — ta sama treść plus zapis zakładki
- `arkusz-mapa/src/saveRate.test.ts` — pada, gdy skrypt się rozjedzie z `saveRate.ts`

## Decisions

- Body: `sklep`, `podwykonawca`, `kwotaPodjazd`, `kwotaWorek`, `odKiedy`. R7 woła te same pola.
- Klucz: adres + nazwa krótka + data `dd.mm.yyyy` po uzupełnieniu zer. Pusta data = od zawsze. `1.9.2026` i `01.09.2026` to ten sam klucz.
- Jeden wiersz: nadpisanie kolumn 3–4. Dwa i więcej: `{ ok: false, error: 'tie' }`. Inna data: dopisanie. Usuwania nie ma.
- Kwota 0 zostaje 0. Puste pole zostaje pusta komórka.
- Brak zakładki: `getOrCreateRefSheet_` z nagłówkami. Format tekstu daty tylko przy założeniu zakładki, żeby nie zamienić istniejących dat na numery seryjne.
- Rejestru ta akcja nie otwiera. Kolumny 14–17 zostają.
- Żywy arkusz i strona mapy zmieniają się dopiero w M6.
