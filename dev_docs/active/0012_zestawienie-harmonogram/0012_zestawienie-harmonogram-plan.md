# Plan: Zestawienie odbiorów z harmonogramu

> **Task:** 0012_zestawienie-harmonogram  
> **Data:** 2026-09-28  
> **Źródło:** arkusz ewidencji (`1hvSvy9c…`) — kontynuacja 0011

## Zakres

1. Nowa zakładka **`zestawienie z harmonogramu`** — rejestr jak Arkusz1 (1 wiersz = odbiór).
2. Sync z `odebrane z harmonogramu` (suma worków) + dni podjazdu z `Baza cen harmonogram` (0 worków = sam podjazd).
3. Odczyt rozliczeń Harmonogram z tej zakładki (nie wirtualne wiersze).
4. Zatwierdź / patchBags na zestawieniu (`tryb=harmonogram`).

## Poza zakresem

- Zmiana układu `odebrane z harmonogramu`
- Auto-sync z GHA (tylko akcja GAS + docs; pipeline opcjonalnie później)
- Statystyki z innym podziałem trybu
