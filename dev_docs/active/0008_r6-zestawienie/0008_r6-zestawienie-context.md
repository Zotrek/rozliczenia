# Context: R6 Zestawienie

> **Task:** 0008_r6-zestawienie  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Kwoty liczy `settle` / `sumSelected`. Widok tylko formatuje grosze na tekst `dd` z przecinkiem. Drugiego wzoru w HTML nie ma.
- Stan ekranu (worki-only, nie odbył się, nadpisany podjazd i worek) jest w `StatementScreen`. Do Bazy stawek nie idzie. Do `approve` idzie koszt już policzony i `nieOdbył`.
- Zapis od razu to POST `text/plain` na ten sam URL Web App co odczyt. Bez sekretu, jak W1.
- Po `approve` i po `resolveRateTie` strona woła `settlementSearch` jeszcze raz. Usunięcie wiersza stawki przesuwa numery, więc lokalna lista stawek nie wystarcza.
- Odepnij pamięta nazwę, z której sklep zszedł, tylko na ekranie. Nowa trasa nie może jej powtórzyć.
- Jednorożec od 1 000 000 groszy. Zostaje co najmniej 3 400 ms, dłużej gdy zapis trwa dłużej. Poniżej progu jest samo pulsujące logo.
- Na żywy arkusz `approve` wchodzi w W1, nie tutaj.

## API strony

- Reguły i body zapisów: `src/statement.ts`
- Tabela: `src/statementView.ts`
- Podpięcie: `src/page.ts`
- Strona: `npm run build` → `rozliczenia/index.html`

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 145 testów, pass (2026-09-19)
