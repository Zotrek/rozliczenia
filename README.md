# Rozliczenia

Osobna strona rozliczania kosztów odbiorów. Czyta ten sam rejestr co mapa plomb, liczy koszt w przeglądarce i przy Zatwierdź dopisuje status, numer faktury i kwoty. Nie jest częścią witryny `arkusz-mapa`: workflow mapy zastępuje całą gałąź `gh-pages`.

## Lokalny build

```bash
cd rozliczenia
npm install
npm test
npm run build    # → index.html
```

Otwórz `index.html`. Adres Web App podajesz w adresie strony: `?webapp=https://script.google.com/.../exec`. Strona zapamiętuje go w tej przeglądarce.

## Publikacja GitHub Pages

1. Settings → Pages → Source: **Deploy from a branch**
2. Branch: `main`, folder: **`/ (root)`**
3. Commit i push `index.html` oraz `logo.png` i `jednorozec-deba.gif`

**Bez GitHub Actions.** Po zmianie kodu: lokalnie `npm test && npm run build` → commit `index.html` → push.

> Pages przy branch deploy obsługuje tylko `/` lub `/docs` — stąd publikacja z roota.
