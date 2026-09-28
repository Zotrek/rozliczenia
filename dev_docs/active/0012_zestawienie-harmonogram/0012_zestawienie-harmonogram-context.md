# Context: Zestawienie z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Last Updated:** 2026-09-28  
> **Status:** implemented

## Decyzje

| # | Temat | Decyzja |
|---|--------|---------|
| 1 | Zakładka | `zestawienie z harmonogramu` (osobna od `odebrane z harmonogramu`) |
| 2 | Ilość worków | Suma jak kolumna I w Arkusz1 (nie lista plomb) |
| 3 | Podjazd bez worków | Tak — dzień z Bazy cen bez worków → wiersz z 0 |
| 4 | Sklep tylko w odebrane | Trafia do zestawienia (stawki puste) |
| 5 | Sync vs rozliczony | `Rozliczony=tak` — sync pomija wiersz |
| 6 | Okno sync | Domyślnie: 1. bieżącego miesiąca → dziś |
| 7 | Zatwierdź | Tak — jak Arkusz1; body z `tryb=harmonogram` |
| 8 | Kiedy sync | Pipeline `COPY_ODEBRANE_Z_HARMONOGRAMU=1` (phase7): po odebrane + Baza cen |

## Pliki

| Warstwa | Ścieżka |
|---------|---------|
| GAS | `arkusz-mapa/google-apps-script/transport-log.gs` |
| Testy GAS | `arkusz-mapa/src/settlementRead.test.ts`, `settlementWrites.test.ts` |
| UI | `rozliczenia/src/rangeView.ts`, `statement.ts`, `page.ts` |
| Docs | `arkusz-mapa/docs/TRANSPORT_SHEET.md` |
