import { rowKey, sumSelected } from "./engine.js";
import { escapeHtml } from "./html.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";
import type { SettlementRateRow } from "./search.js";
import {
  canPressApprove,
  currentStatement,
  formatAmountInput,
  formatPln,
  positionLabel,
  routeSelectionKey,
  selectedKeys,
  selectedLineCount,
  type StatementScreen,
} from "./statement.js";
import type { Grosze, RateTie, ShopCost, StatementLine } from "./types.js";

const DASH = '<span class="muted">—</span>';

export function renderStatement(
  screen: StatementScreen,
  status = "",
  options: { allowApprove?: boolean } = {},
): string {
  const allowApprove = options.allowApprove !== false;
  const statement = currentStatement(screen);
  const selectedSum = sumSelected(statement, selectedKeys(screen.selected));
  const count = selectedLineCount(statement, screen.selected);
  const note = status ? `<p class="err">${escapeHtml(status)}</p>` : "";
  const emptyHint = allowApprove
    ? "Brak nierozliczonych odbiorów tego podwykonawcy w podanym zakresie."
    : "Brak dni podjazdu tego podwykonawcy w podanym zakresie (Baza cen harmonogram).";
  const body =
    statement.lines.length === 0
      ? `<div class="blank"><strong>Brak pozycji.</strong><p>${emptyHint}</p></div>`
      : table(screen, statement.lines);
  return (
    `<div class="center-h">${escapeHtml(positionLabel(statement.lines.length))}</div>` +
    note +
    body +
    footer(screen.invoice, statement.total, selectedSum, count, allowApprove)
  );
}

function table(screen: StatementScreen, lines: readonly StatementLine[]): string {
  const rows: string[] = [];
  for (const line of lines) {
    if (line.kind === "plain") {
      rows.push(plainRow(screen, line.shop));
      continue;
    }
    rows.push(routeRow(screen, line));
    if (!screen.openRoutes[line.routeName]) {
      continue;
    }
    const shared = line.bagRate !== null;
    for (const shop of line.shops) {
      rows.push(childRow(screen, shop, shared));
    }
  }
  return (
    '<div class="table-wrap"><table><thead><tr>' +
    "<th class=\"c\">Rozliczone</th><th>Numer protokołu</th><th>Adres</th><th>Sklep</th><th>Data</th>" +
    "<th>Podjazd/Trasa</th><th class=\"num\">Liczba worków</th><th class=\"num\">Kwota za worek</th>" +
    "<th class=\"num\">Suma za worki</th><th class=\"num\">Koszt odbioru</th>" +
    "<th class=\"num\" title=\"Tylko na ekranie. Nie zapisuje się jako jedna kwota.\">Suma trasy</th>" +
    "<th>transport się odbył</th>" +
    `</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
  );
}

function plainRow(screen: StatementScreen, shop: ShopCost): string {
  const key = rowKey(shop.sheetRow, shop.transportNumber);
  const line = encodeURIComponent(key);
  const dead = !shop.happened;
  const checked = screen.selected[key] === true;
  const state = screen.screenByRow[key] ?? {};
  const leg = shop.bagsOnly || shop.tie
    ? DASH
    : dead
      ? money(shop.legAmount, true)
      : `<span class="tag">podjazd</span>${amountInput(shop, "pickup", state.pickupAmount, shop.legAmount, "Zmiana kwoty za podjazd tylko na tym ekranie — nie w rejestrze ani w Bazie stawek")}`;
  const bagCell = shop.tie
    ? DASH
    : amountInput(shop, "bag-rate", state.bagAmount, shop.bagRate, "Zmiana kwoty za worek tylko na tym ekranie — nie w rejestrze ani w Bazie stawek");
  return (
    `<tr class="${rowClass(dead, checked, "plain")}" data-kind="plain">` +
    `<td class="c">${lineBox(line, checked)}</td>` +
    `<td>${text(shop.transportNumber, dead)}</td>` +
    `<td class="adres">${text(addressWithCommaAfterLocality(shop.address), dead)}</td>` +
    `<td class="sklep"><div>${text(shop.shopName, dead)}${bagsOnlyBox(shop, shop.bagsOnly)}${tieBox(shop.tie, screen.rates)}${newRouteBox(screen, shop)}</div></td>` +
    `<td>${text(shop.pickupDate, dead)}</td>` +
    `<td>${leg}</td>` +
    `<td class="num">${bagCountInput(shop, "Zapis od razu do Ilość worków")}</td>` +
    `<td class="num">${bagCell}</td>` +
    `<td class="num">${money(shop.bagSum, dead)}</td>` +
    `<td class="num">${money(shop.receptionCost, dead)}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td>${tripBox(shop)}</td>` +
    "</tr>"
  );
}

function routeRow(screen: StatementScreen, line: Extract<StatementLine, { kind: "route" }>): string {
  const key = routeSelectionKey(line.routeName);
  const checked = screen.selected[key] === true;
  const open = screen.openRoutes[line.routeName] === true;
  const anchor = line.shops[0];
  const happened = line.shops.filter((shop) => shop.happened).length;
  const sub = happened === line.shops.length ? shopsWord(line.shops.length) : `${happened} z ${line.shops.length} w koszcie`;
  const none = happened === 0 ? '<div class="sub">Żaden sklep się nie odbył — kosztu trasy nie ma.</div>' : "";
  const tie = line.shops.some((shop) => shop.tie) ? '<div class="err">Remis stawek. Rozwiń i wskaż wiersz.</div>' : "";
  const date = line.date === null ? DASH : escapeHtml(line.date);
  const bagRate =
    line.bagRate === null || !anchor
      ? DASH
      : amountInput(
          anchor,
          "bag-rate-route",
          undefined,
          line.bagRate,
          "Jedna kwota, bo każdy adres, który się odbył, ma tę samą. Zmiana tylko na tym ekranie.",
          line.routeName,
        );
  const rateInput = anchor
    ? amountInput(
        anchor,
        "route-rate",
        undefined,
        line.routeRate,
        "Zapis od razu do Stawka za trasę. Kolumny 16 i 17 dopiero przy Zatwierdź",
        line.routeName,
      )
    : DASH;
  return (
    `<tr class="${rowClass(false, checked, "route")}" data-kind="route">` +
    `<td class="c">${lineBox(encodeURIComponent(key), checked)}</td>` +
    `<td>${DASH}</td>` +
    `<td class="adres"><div class="who-line"><button type="button" class="chev" data-action="expand" data-route="${escapeHtml(line.routeName)}" aria-expanded="${open ? "true" : "false"}" aria-label="Sklepy trasy">${open ? "▾" : "▸"}</button>` +
    `<div><div>${escapeHtml(line.routeName)}</div><div class="sub">trasa · ${escapeHtml(sub)}</div>${none}${tie}</div></div></td>` +
    `<td class="sklep">${DASH}</td>` +
    `<td data-out="route-date">${date}</td>` +
    `<td><span class="tag tag-route">trasa</span>${rateInput}</td>` +
    `<td class="num"><span>${line.bagCount}</span></td>` +
    `<td class="num">${bagRate}</td>` +
    `<td class="num">${money(line.bagSum, false)}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td class="num">${money(line.routeSum, false)}</td>` +
    `<td>${DASH}</td>` +
    "</tr>"
  );
}

function childRow(screen: StatementScreen, shop: ShopCost, sharedBagRate: boolean): string {
  const dead = !shop.happened;
  const state = screen.screenByRow[rowKey(shop.sheetRow, shop.transportNumber)] ?? {};
  const bagCell = shop.tie || sharedBagRate
    ? DASH
    : amountInput(shop, "bag-rate", state.bagAmount, shop.bagRate, "Kwota tego adresu, tylko ten ekran. Nie zapisuje kolumn rejestru ani Bazy stawek.");
  return (
    `<tr class="${rowClass(dead, false, "child")}" data-kind="child">` +
    "<td></td>" +
    `<td>${text(shop.transportNumber, dead)}</td>` +
    `<td class="adres">${text(addressWithCommaAfterLocality(shop.address), dead)}</td>` +
    `<td class="sklep"><div>${text(shop.shopName, dead)}${tieBox(shop.tie, screen.rates)}</div></td>` +
    `<td>${text(shop.pickupDate, dead)}</td>` +
    `<td>${DASH}</td>` +
    `<td class="num">${bagCountInput(shop, "Zapis od razu do Ilość worków tego adresu")}</td>` +
    `<td class="num">${bagCell}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td><div class="trip-stack">${tripBox(shop)}${detachButton(shop)}</div></td>` +
    "</tr>"
  );
}

function footer(
  invoice: string,
  total: Grosze,
  selected: Grosze,
  count: number,
  allowApprove: boolean,
): string {
  if (!allowApprove) {
    return (
      '<footer class="footer">' +
      `<div class="stat"><span>Suma zestawienia</span><b data-out="sum-all">${formatPln(total)}</b></div>` +
      '<p class="note">Tryb Harmonogram: podgląd kosztów. Zatwierdzenie faktury w tej wersji niedostępne.</p>' +
      "</footer>"
    );
  }
  const enabled = canPressApprove(invoice, count);
  return (
    '<footer class="footer">' +
    `<div class="stat"><span>Suma zestawienia</span><b data-out="sum-all">${formatPln(total)}</b></div>` +
    `<div class="stat sel"><span>Suma zaznaczonych · <span data-out="sel-count">${count}</span></span><b data-out="sum-sel">${formatPln(selected)}</b></div>` +
    '<div class="grow"><label class="field"><span>Numer faktury</span>' +
    `<input class="invoice" id="invoice" data-edit="invoice" data-keep="invoice" value="${escapeHtml(invoice)}" placeholder="FV/123/09/2026" autocomplete="off"></label>` +
    `<button type="button" class="btn-go" data-action="approve"${enabled ? "" : " disabled"}>Zatwierdź</button></div></footer>`
  );
}

function rowClass(dead: boolean, checked: boolean, kind: "plain" | "route" | "child"): string {
  return [
    kind === "route" ? "is-route" : "",
    kind === "child" ? "is-child" : "",
    dead ? "is-dead" : "",
    checked ? "is-checked" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function lineBox(line: string, checked: boolean): string {
  return `<input type="checkbox" data-toggle="checked" data-line="${escapeHtml(line)}"${checked ? " checked" : ""} aria-label="Rozliczone">`;
}

function bagsOnlyBox(shop: ShopCost, on: boolean): string {
  return (
    `<label class="only"><input type="checkbox" data-toggle="bags-only" ${ref(shop)}${on ? " checked" : ""} aria-label="tylko za liczbę worków"> tylko za liczbę worków</label>`
  );
}

function tripBox(shop: ShopCost): string {
  const on = !shop.happened;
  return `<label class="trip"><input type="checkbox" data-toggle="notrip" ${ref(shop)}${on ? " checked" : ""}> nie odbył się</label>`;
}

function detachButton(shop: ShopCost): string {
  return `<button type="button" class="btn-detach" data-action="detach" ${ref(shop)} title="Zapis od razu. Sklep schodzi z trasy i zostaje odbiorem za podjazd.">odepnij od trasy</button>`;
}

function newRouteBox(screen: StatementScreen, shop: ShopCost): string {
  const key = rowKey(shop.sheetRow, shop.transportNumber);
  const left = screen.leftRoute[key];
  if (!left) {
    return "";
  }
  const draft = screen.routeDraft[key] ?? { name: "", rate: "" };
  const error = screen.routeDraftError[key];
  return (
    '<div class="new-route">' +
    `<span class="sub">odpięty od ${escapeHtml(left)}</span>` +
    `<input type="text" data-draft="route-name" data-keep="draft-name-${shop.sheetRow}" ${ref(shop)} value="${escapeHtml(draft.name)}" placeholder="nazwa nowej trasy" autocomplete="off" title="Inna nazwa niż trasa, z której sklep zszedł.">` +
    `<input type="text" inputmode="decimal" data-draft="route-rate" data-keep="draft-rate-${shop.sheetRow}" ${ref(shop)} value="${escapeHtml(draft.rate)}" placeholder="stawka" title="Pusta nie zapisuje trasy. Kwota 0 jest wpisana.">` +
    `<button type="button" class="btn-mini" data-action="attach" ${ref(shop)}>Osobna trasa</button>` +
    (error ? `<span class="err">${escapeHtml(error)}</span>` : "") +
    "</div>"
  );
}

function tieBox(tie: RateTie | null, rates: readonly SettlementRateRow[]): string {
  if (!tie) {
    return "";
  }
  const buttons = tie.candidates
    .map((candidate) => {
      const rate = rates[candidate.index];
      if (!rate) {
        return "";
      }
      const from = candidate.validFrom === "" ? "od zawsze" : candidate.validFrom;
      const pickup = candidate.pickupAmount === null ? "—" : formatPln(candidate.pickupAmount);
      const bag = candidate.bagAmount === null ? "—" : formatPln(candidate.bagAmount);
      return `<button type="button" class="btn-mini" data-action="resolve-tie" data-rate-row="${rate.sheetRow}">${escapeHtml(from)} · podjazd ${pickup} · worek ${bag}</button>`;
    })
    .join("");
  return `<div class="tie"><span class="err">Dwie stawki na ten dzień. Wskaż, która obowiązuje.</span>${buttons}</div>`;
}

function bagCountInput(shop: ShopCost, title: string): string {
  const shown = shop.bagCount === null ? "" : String(shop.bagCount);
  return `<input type="text" inputmode="numeric" data-edit="bags" ${ref(shop)} value="${escapeHtml(shown)}" title="${escapeHtml(title)}" autocomplete="off">`;
}

function amountInput(
  shop: ShopCost,
  edit: string,
  override: Grosze | null | undefined,
  shown: Grosze | null,
  title: string,
  routeName?: string,
): string {
  const value = override === null ? "" : override !== undefined ? formatAmountInput(override) : shown === null ? "" : formatAmountInput(shown);
  const route = routeName ? ` data-route="${escapeHtml(routeName)}"` : "";
  return `<input type="text" inputmode="decimal" data-edit="${edit}" ${ref(shop)}${route} value="${escapeHtml(value)}" title="${escapeHtml(title)}" autocomplete="off">`;
}

function money(value: Grosze | null, dead: boolean): string {
  if (value === null) {
    return DASH;
  }
  const text = formatPln(value);
  return dead ? `<span class="strike">${text}</span>` : `<span class="money">${text}</span>`;
}

function text(value: string, dead: boolean): string {
  if (value === "") {
    return DASH;
  }
  const safe = escapeHtml(value);
  return dead ? `<span class="strike">${safe}</span>` : safe;
}

function ref(shop: ShopCost): string {
  return `data-sheet-row="${shop.sheetRow}" data-transport="${escapeHtml(shop.transportNumber)}"`;
}

function shopsWord(count: number): string {
  if (count === 1) {
    return "1 sklep";
  }
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} sklepy`;
  }
  return `${count} sklepów`;
}
