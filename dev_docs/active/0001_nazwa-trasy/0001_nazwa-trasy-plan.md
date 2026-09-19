# Plan: M1 nazwa trasy

Źródło: [`rozliczenia/docs/PLAN.md`](../../../docs/PLAN.md), punkt M1.

Jedna funkcja `proposeRouteName` w `arkusz-mapa/src/routeName.ts`. HTML dostaje jej źródło, nie drugą kopię reguł. Pamięć sesji i okno protokołu są w M2. `routeNameProposal` w Apps Script nie powstaje w tym zadaniu: skrypt ma tylko oddać zajęte nazwy, propozycję liczy funkcja.
