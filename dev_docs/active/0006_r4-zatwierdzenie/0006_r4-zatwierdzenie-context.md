# Context: R4 Zatwierdzenie

> **Task:** 0006_r4-zatwierdzenie  
> **Last Updated:** 2026-09-19  
> **Status:** zrobione

## Decyzje

- Jedna kopia reguł, w `transport-log.gs`. Test w `rozliczenia` odpala `doPost` na fałszywym arkuszu. Silnik kosztów nie jest wołany drugi raz.
- `koszt` w body to grosze, tak jak `receptionCost` z silnika. Komórki 16 i 17 dostają złote. `30.5` nie jest kosztem — to nie są grosze.
- Kolumna 17 to `koszt / ilość worków` z kolumny 9 pod lockiem. Pusta ilość albo 0 dzieli przez 1. Zaokrąglenie jak w silniku: cyfra 5 w górę.
- `tylkoWorki`, `kwotaPodjazd` i `kwotaWorek` jadą w body, bo arkusz ich nie pamięta. Skrypt ich nie czyta.
- Remis liczy skrypt sam, po adresie (kolumna 2) i nazwie krótkiej (kolumna 6), nie po fladze z ekranu. Starszy dublet, który przegrywa z późniejszą datą, nie blokuje. Brak zakładki Baza stawek to brak remisu, nie nowa zakładka.
- Wiersz trasy nie jest jednym rekordem. Body niesie sklepy. Niezaznaczony sklep tej samej nazwy zostaje.
- Sklep z „nie odbył się” dostaje samo `nie` w kolumnie 18. Bez `tak`, bez faktury, bez kolumn 16 i 17. Remis blokuje także ten zapis.
- Wiersz, który w arkuszu ma już kolumnę 18 = `nie`, nie dostaje kolumn 16–17. Nagłówków rejestru ta akcja nie wpisuje.
- Żywy arkusz zmienia się dopiero w W1, nie w M6.

## API

POST, `text/plain`, pod lockiem.

Body: `numerFaktury`, `wiersze[]`. Każdy wiersz: `sheetRow`, `transportNumber`, `koszt` (grosze), `nieOdbył` (`true` albo `nie`).

Odmowa całości: `{ ok: false, error: "invoice" | "selection" }`. Nic nie jest zapisane.

Sukces, także gdy część wierszy odpadła: `{ ok: true, zapisane, pominiete }`.

| Powód w `pominiete` | Kiedy |
|---------------------|--------|
| `key` | Para numeru wiersza i kolumny 1 się nie zgadza |
| `settled` | Kolumna 14 jest już `tak` |
| `tie` | Nierozstrzygnięty remis stawki na dzień odbioru |
| `nie` | Kolumna 18 jest już `nie`, a body nie prosi o samo `nie` |
| `date` | Data odbioru nie jest tekstem `dd.mm.yyyy` |
| `cost` | Brak kosztu albo koszt nie jest całkowitymi groszami. Zero jest kosztem |

Odbyty zapis: kolumna 14 `tak`, 15 numer faktury, 16 i 17 kwoty. Kolumna 18 zostaje. `nie`: tylko kolumna 18.

## Checkpoint

- **CP1:** `npm test` w `rozliczenia/` — 91 testów, pass (2026-09-19)
- **Regresja:** `npm test` w `arkusz-mapa/` — 472 testy, pass (2026-09-19)
