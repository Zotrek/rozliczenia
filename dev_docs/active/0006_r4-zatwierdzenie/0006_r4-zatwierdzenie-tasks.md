# Tasks: R4 Zatwierdzenie

> **Task:** 0006_r4-zatwierdzenie  
> **Updated:** 2026-09-19

## Implementation

- [x] `approve` odmawia bez numeru faktury i bez zaznaczenia. Nic wtedy nie zapisuje
- [x] Odbyty wiersz: `tak`, faktura, kolumny 16 i 17. Koszt z payloadu, w groszach. Zero zostaje
- [x] Kolumna 17: koszt / ilość worków. Pusta ilość albo 0 dzieli przez 1
- [x] „Nie odbył się”: samo `nie` w kolumnie 18. Bez `tak`, bez faktury, bez kolumn 16 i 17
- [x] Wiersz trasy rozpisany na sklepy. Wiersz spoza zaznaczenia zostaje, także `nie` się tam nie zapisuje
- [x] Remis pomija wiersz, reszta zaznaczenia się zapisuje. Zła para i wiersz już `tak` też są pomijane
- [x] Skrypt nie liczy kosztu z bazy drugi raz. Nagłówków rejestru nie wpisuje. `saveRate` nie powstaje drugi raz
- [x] **CHECKPOINT 1:** `npm test` w `rozliczenia/` — 91 testów, pass ✅ (2026-09-19)

## Documentation Updates

- [x] Update `-tasks.md` after each subtask
- [x] Update `-context.md` (kontrakt `approve`)
- [x] `-plan.md` — zakres R4 bez zmiany wymagań
