# Plan: M5 ostatnia data transportu

Źródło: [`rozliczenia/docs/PLAN.md`](../../../docs/PLAN.md), punkt M5.

`buildBulkLastTransportDatesMap_` i `findLastTransportInfo_` pomijają wiersz z kolumną 18 = `nie`. Taki wiersz nie ustawia daty odcięcia worków i nie jest ostatnim odbiorem w popupie. Inna wartość, pusta komórka i brak kolumny zostają odbiorem. Żywy arkusz zmienia się dopiero w M6.
