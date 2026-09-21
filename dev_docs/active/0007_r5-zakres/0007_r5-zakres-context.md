# Context: R5 Ekran Zakres

> **Task:** 0007_r5-zakres  
> **Last Updated:** 2026-09-21  
> **Status:** zrobione

## Decyzje

- Reguły filtra są w `src/range.ts`. `scripts/build-page.mjs` składa je z widokiem i podpięciem DOM do jednego `index.html`. Drugiej kopii zdania o dacie początkowej nie ma.
- Daty z pola `type="date"` są `yyyy-mm-dd`. Do `settlementSearch` idą jako `dd.mm.yyyy`, cięciem tekstu, bez `Date`, żeby dzień się nie przesunął.
- Wiersze i tak filtruje `buildSettlementRead_`. Test R5 karmi tę funkcję zapytaniem z `startSearch`.
- Do rozliczenia wchodzi `nazwa` z listy, pisownia z arkusza, nie wpisany tekst i nie Dane do Worda.
- Szukaj woła `GET settlementSearch`. Lista to `GET listContractors`. Adres Web App przy publikacji wchodzi do `index.html` z sekretu `TRANSPORT_WEBAPP_URL`. `?webapp=` i `localStorage` (`rozliczenia.webapp`) zostają, gdy build poszedł bez adresu.
- Baza stawek to `role="dialog"` na tym samym ekranie. Pól okna nie ma: R7.
- Po udanym Szukaj ekran to zestawienie z nagłówkiem zakresu i Zmień zakres. Tabeli nie ma: R6.

## API strony

- `startSearch`, `fieldsForSearch`, `applyNoStartDate`, `matchingContractors`, `selectedContractor` — `src/range.ts`
- `renderApp` — `src/rangeView.ts`
- Strona: `npm run build` → `rozliczenia/index.html`

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 119 testów, pass (2026-09-19)
