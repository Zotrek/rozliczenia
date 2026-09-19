# Plan: M3 zapis wiersza

Źródło: [`rozliczenia/docs/PLAN.md`](../../../docs/PLAN.md), punkt M3.

`appendTransportRow_` w `arkusz-mapa/google-apps-script/transport-log.gs` przed każdym wierszem protokołu wpisuje puste nagłówki 12–18 i raz zakłada listę oraz przekreślenie. Body z kluczem `trasa` dopisuje kolumny 12–13 i rozpropagowuje stawkę na nierozliczone wiersze o tym samym tekście. `TRANSPORT_SHEET.md` opisuje te kolumny i pola body.
