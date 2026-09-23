# Rozliczenia

Osobna strona rozliczania kosztów odbiorów. Czyta ten sam rejestr co mapa plomb, liczy koszt w przeglądarce i przy Zatwierdź dopisuje status, numer faktury i kwoty. Widoki: **Zakres**, **Zestawienie**, **Statystyki** (raport odczytowy). Nie jest częścią witryny `arkusz-mapa`: workflow mapy zastępuje całą gałąź `gh-pages`.

Dokumentacja: [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PLAN.md`](docs/PLAN.md) (etap R8 = Statystyki). Makiety: [`docs/makiety-tabeli.html`](docs/makiety-tabeli.html), [`docs/makiety-statystyki.html`](docs/makiety-statystyki.html).

## Lokalny build

```bash
cd rozliczenia
npm install
npm test
npm run build    # → index.html
```

Otwórz `index.html`. Adres Web App wchodzi przy buildzie ze zmiennej `TRANSPORT_WEBAPP_URL` (lokalnie albo z sekretu GitHub). Bez niej zostaje `?webapp=` i pamięć przeglądarki.

## Publikacja GitHub Pages

1. W repozytorium rozliczeń: Settings → Secrets → `TRANSPORT_WEBAPP_URL` = `https://script.google.com/.../exec`
2. Settings → Pages → Source: **Deploy from a branch** → gałąź **`gh-pages`**, folder **`/ (root)`**
3. Push na `main` albo Actions → „rozliczenia — Pages” → Run workflow

Workflow buduje `index.html` z sekretu i publikuje go na `gh-pages` razem z `logo.png` i `jednorozec-deba.gif`. Adres nie jest zapisywany na `main`.
