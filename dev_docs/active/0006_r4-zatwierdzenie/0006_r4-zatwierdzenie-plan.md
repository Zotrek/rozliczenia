# Plan: R4 Zatwierdzenie

> **Task:** 0006_r4-zatwierdzenie  
> **Źródło:** [`docs/PLAN.md`](../../../docs/PLAN.md) punkt R4, zatwierdzony 2026-09-19  
> **Reguły:** [`docs/SPECIFICATION.md`](../../../docs/SPECIFICATION.md), kontrakt w [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)

## Zakres

Jedna akcja POST `approve` w `arkusz-mapa/google-apps-script/transport-log.gs`, pod tym samym lockiem co protokół.

Payload: numer faktury, zaznaczone wiersze (para klucza) i stan ekranu, którego arkusz nie pamięta. Skrypt zapisuje koszt z payloadu. Nie liczy go drugi raz z bazy stawek.

Bez numeru faktury albo bez zaznaczenia odmawia całości. Remis, zła para, wiersz już `tak` i wiersz z kolumną 18 = `nie` (gdy ekran nie prosi o samo `nie`) są pomijane. Reszta zaznaczenia się zapisuje. Wiersza spoza listy nie rusza.

## Poza zakresem

Ekran (R5–R7), wdrożenie na żywy arkusz (W1). `saveRate` nie powstaje tu drugi raz.
