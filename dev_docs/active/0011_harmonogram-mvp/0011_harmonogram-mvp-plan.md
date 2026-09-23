# Plan: Harmonogram MVP w rozliczeniach

> **Task:** 0011_harmonogram-mvp  
> **Data:** 2026-09-23  
> **Źródło:** arkusz ewidencji (`1hvSvy9c…`) — **nie** druga mila

## Zakres

1. **Okno Baza cen harmonogram** — zakładka obok Bazy stawek; POST `saveRateHarmonogram` (+ `dniOdbiorow`).
2. **Szukaj + Harmonogram** — zestawienie z dni podjazdu:
   - sklepy / dni / stawki: `Baza cen harmonogram`;
   - worki: `odebrane z harmonogramu` (może być 0);
   - wiersz za każdy dzień podjazdu nawet bez worków.
3. **Bez Zatwierdź** w trybie Harmonogram (podgląd kosztów).

## Poza zakresem

- Zapis faktury / kolumna trybu w `Arkusz1`
- Snapshot protokołu z Bazy cen
- Statystyki z prawdziwym podziałem trybu
- Druga mila
