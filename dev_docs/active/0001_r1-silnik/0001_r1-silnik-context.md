# Context: R1 Silnik kosztów

> **Task:** 0001_r1-silnik  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Kwoty w silniku są w **groszach** (`30 zł = 3000`). Dzięki temu 100 / 3 = 33,33 zł i suma udziałów 99,99 zł nie rozjeżdża się na float. `toGrosze` jest bramą dla odczytu z arkusza, nie liczeniem wewnątrz.
- Daty zostają tekstem `dd.mm.yyyy`. Porównanie jest kalendarzowe. Pusty tekst w Bazie stawek jest starszy niż każda wpisana data. ISO jest odrzucane.
- Klucz stawki to adres + nazwa krótka + data odbioru. Kolumna Sklep nie skleja wierszy.
- Remis (dwa wiersze tej samej pary i tej samej obowiązującej daty) daje `receptionCost: null` i wpis w `ties`. To nie jest 0 zł. Starszy dublet, który przegrywa z późniejszą datą, nie blokuje.
- Brak pary, pusta stawka worka albo 0: opłata 0 zł, bez remisu.
- Udział trasy liczy sklepy widoczne w wejściu, które się odbyły. Zero takich sklepów: kosztu trasy nie ma, dzielnika 1 nie ma. Pusta albo zerowa stawka: udział 0.
- Suma zestawienia i suma zaznaczonych liczą wiersz trasy raz. Klucz sklepu z rozwinięcia nic nie dodaje.
- `null` w kwocie na ekranie znaczy „—”. Transport, który się nie odbył, ma koszt 0 i `costPerBag: null` (kolumny 16 i 17 puste).

## API

- `settle`, `sumSelected`, `rowKey`, `lineKey` — `src/engine.ts`
- `resolveRate` — `src/rates.ts`
- Typy — `src/types.ts`

## Pliki

- `package.json` — typescript `^5.7.2`, vitest `^2.1.6`, jak arkusz-mapa
- `src/engine.ts`, `src/rates.ts`, `src/money.ts`, `src/sheetDate.ts`, `src/types.ts`
- Testy obok: `engine.test.ts`, `money.test.ts`, `sheetDate.test.ts`

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 38 testów, pass (2026-09-19)
