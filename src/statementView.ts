import { lineKey, rowKey, sumSelected } from "./engine.js";
import { escapeHtml } from "./html.js";
import {
  allPicked,
  applyButtonLabel,
  applyIsDisabled,
  chosenComments,
  commentKey,
  commentTargets,
  commentsToOverwrite,
  overwriteHint,
  routeCommentFace,
  routePickNote,
  selectionSummary,
  willOverwrite,
  type CommentTarget,
} from "./invoiceComment.js";
import { calendarToIsoDate } from "./range.js";
import { addressWithCommaAfterLocality } from "./rateWindow.js";
import { parseSheetDate } from "./sheetDate.js";
import type { SettlementRateRow } from "./search.js";
import { columnBar, renderColumnFilterMenu } from "./statsView.js";
import {
  canPressApprove,
  currentStatement,
  formatAmountInput,
  formatPln,
  routeSelectionKey,
  selectedKeys,
  selectedLineCount,
  type StatementColumnKey,
  type StatementScreen,
} from "./statement.js";
import {
  STATEMENT_COLUMNS,
  statementColumnChoices,
  statementCountLabel,
  statementQueryHits,
  statementSortPhrase,
  visibleStatementLines,
} from "./statementTable.js";
import type { Grosze, RateTie, ShopCost, Statement, StatementLine } from "./types.js";

const DASH = '<span class="muted">—</span>';
const STATEMENT_FUNNEL =
  '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M1.5 2.5h13l-5 6.1V13l-3 1.1V8.6z"/></svg>';

export function renderStatement(
  screen: StatementScreen,
  status = "",
  options: { allowApprove?: boolean } = {},
): string {
  const allowApprove = options.allowApprove !== false;
  const statement = currentStatement(screen);
  const visible = visibleStatementLines(screen, statement);
  const shown: Statement = {
    ...statement,
    lines: visible.map((item) =>
      item.kind === "plain" ? item.line : { ...item.line, shops: item.shops },
    ),
  };
  const selectedSum = sumSelected(statement, selectedKeys(screen.selected));
  const count = selectedLineCount(statement, screen.selected);
  const note = status ? `<p class="err status-block">${escapeHtml(status)}</p>` : "";
  const commentNote = screen.commentNotice
    ? `<p class="notice" role="status" data-out="comment-notice">${escapeHtml(screen.commentNotice)}</p>`
    : "";
  const emptyHint = allowApprove
    ? "Brak nierozliczonych odbiorów tego podwykonawcy w podanym zakresie."
    : "Brak dni podjazdu tego podwykonawcy w podanym zakresie (Baza cen harmonogram).";
  const body =
    statement.lines.length === 0
      ? `<div class="blank"><strong>Brak pozycji.</strong><p>${emptyHint}</p></div>`
      : table(screen, shown);
  const composer = shown.lines.length === 0 ? "" : commentComposer(screen, shown);
  return (
    `<div class="center-h">${escapeHtml(statementCountLabel(shown.lines.length, statement.lines.length))}</div>` +
    note +
    commentNote +
    body +
    composer +
    footer(screen.invoice, statement.total, selectedSum, count, allowApprove)
  );
}

function table(screen: StatementScreen, statement: Statement): string {
  const targets = commentTargets(statement, screen.invoiceComments);
  const rows: string[] = [];
  for (const line of statement.lines) {
    if (line.kind === "plain") {
      rows.push(plainRow(screen, line.shop, targets));
      continue;
    }
    rows.push(routeRow(screen, line, targets));
    if (!screen.openRoutes[line.routeName]) {
      continue;
    }
    const shared = line.bagRate !== null;
    for (const shop of line.shops) {
      rows.push(childRow(screen, shop, shared, targets));
    }
  }
  const body =
    rows.length === 0
      ? `<tr><td class="note" colspan="${STATEMENT_COLUMNS.length}">Brak pozycji dla tego filtra.</td></tr>`
      : rows.join("");
  return (
    columnBar(STATEMENT_COLUMNS, screen.table, "statement", statementSortPhrase) +
    '<div class="table-wrap"><table><thead><tr>' +
    statementHead(screen, statement.lines) +
    `</tr></thead><tbody>${body}</tbody></table></div>`
  );
}

function statementHead(screen: StatementScreen, lines: readonly StatementLine[]): string {
  const state = screen.table;
  const filtered = (Object.keys(state.filters) as StatementColumnKey[]).some((key) => state.filters[key] != null);
  return STATEMENT_COLUMNS.map((col) => {
    const open = state.menu?.column === col.key;
    const on = state.filters[col.key] != null;
    const sort = state.sortKey === col.key ? state.sortDir : null;
    const mark = sort === "asc" ? "▲" : sort === "desc" ? "▼" : STATEMENT_FUNNEL;
    const extra = col.key === "settled" ? "c " : col.key === "comment" ? "comment-col wrap " : "";
    const numeric = col.numeric ? "num " : "";
    const title =
      col.key === "total"
        ? ' title="Podjazd: kwota podjazdu plus worki. Trasa: stawka raz plus worki."'
        : "";
    const label =
      col.key === "settled"
        ? `<span class="col-check"><span>Rozliczone</span>${selectAllBox(lines, screen.selected, filtered)}</span>`
        : `<span>${escapeHtml(col.label)}</span>`;
    return (
      `<th class="${numeric}${extra}xl-th${open ? " is-open" : ""}"${title}>` +
      `<div class="xl-head">${label}` +
      `<button type="button" class="xl-btn${on ? " is-on" : ""}" data-action="statement-menu" data-col="${col.key}"` +
      ` aria-expanded="${open ? "true" : "false"}" aria-label="${escapeHtml(statementFilterButtonLabel(col.label, on, sort))}">${mark}</button>` +
      "</div>" +
      (open ? statementMenu(screen, col.key) : "") +
      "</th>"
    );
  }).join("");
}

function statementMenu(screen: StatementScreen, column: StatementColumnKey): string {
  const menu = screen.table.menu;
  if (!menu || menu.column !== column) {
    return "";
  }
  const choices = statementColumnChoices(screen, currentStatement(screen), column);
  const visible = choices.filter((text) => statementQueryHits(text, menu.query));
  const label = STATEMENT_COLUMNS.find((item) => item.key === column)?.label ?? column;
  return renderColumnFilterMenu({
    action: "statement",
    column,
    label,
    sortAscLabel: statementSortPhrase(column, "asc"),
    sortDescLabel: statementSortPhrase(column, "desc"),
    sortDir: screen.table.sortKey === column ? screen.table.sortDir : null,
    hasFilter: screen.table.filters[column] != null,
    query: menu.query,
    visible,
    picked: new Set(menu.draft),
  });
}

function statementFilterButtonLabel(label: string, filtered: boolean, sort: "asc" | "desc" | null): string {
  const bits = [`Sortuj i filtruj kolumnę ${label}`];
  if (filtered) {
    bits.push("filtr włączony");
  }
  if (sort === "asc") {
    bits.push("sortowanie rosnąco");
  }
  if (sort === "desc") {
    bits.push("sortowanie malejąco");
  }
  return bits.join(", ");
}

function plainRow(screen: StatementScreen, shop: ShopCost, targets: readonly CommentTarget[]): string {
  const key = rowKey(shop.sheetRow, shop.transportNumber, shop.sheetName);
  const line = encodeURIComponent(key);
  const dead = !shop.happened;
  const checked = screen.selected[key] === true;
  const state = screen.screenByRow[key] ?? {};
  const legKind = shop.tie || dead ? DASH : `<span class="tag">podjazd</span>`;
  const legAmount = shop.tie
    ? DASH
    : dead
      ? money(shop.legAmount, true)
      : amountInput(shop, "pickup", state.pickupAmount, shop.legAmount, "Zmiana kwoty za podjazd tylko na tym ekranie — nie w rejestrze ani w Bazie stawek");
  const bagCell = shop.tie
    ? DASH
    : amountInput(shop, "bag-rate", state.bagAmount, shop.bagRate, "Zmiana kwoty za worek tylko na tym ekranie — nie w rejestrze ani w Bazie stawek");
  const target = targets.find((item) => item.key === commentKey(shop));
  return (
    `<tr class="${joinClass(rowClass(dead, checked, "plain"), shopCommentClass(target, screen))}" data-kind="plain">` +
    `<td class="c">${lineBox(line, checked)}</td>` +
    `<td>${text(shop.transportNumber, dead)}</td>` +
    shopAddress(shop, dead, target, screen) +
    `<td class="sklep"><div>${text(shop.shopName, dead)}${tieBox(shop.tie, screen.rates)}${newRouteBox(screen, shop)}</div></td>` +
    `<td>${dateInput(shop, "pickup-date", shop.pickupDate, "Zapis od razu do Data odbioru.")}</td>` +
    `<td>${legKind}</td>` +
    `<td class="num">${legAmount}</td>` +
    `<td class="num">${bagCountInput(shop, "Zapis od razu do Ilość worków")}</td>` +
    `<td class="num">${bagCell}</td>` +
    `<td class="num">${money(shop.bagSum, dead)}</td>` +
    `<td class="num">${money(shop.receptionCost, dead)}</td>` +
    `<td>${tripBox(shop)}</td>` +
    commentCell(shop, target) +
    "</tr>"
  );
}

function routeRow(
  screen: StatementScreen,
  line: Extract<StatementLine, { kind: "route" }>,
  targets: readonly CommentTarget[],
): string {
  const key = routeSelectionKey(line.routeName);
  const checked = screen.selected[key] === true;
  const open = screen.openRoutes[line.routeName] === true;
  const anchor = line.shops[0];
  const happened = line.shops.filter((shop) => shop.happened).length;
  const sub = happened === line.shops.length ? shopsWord(line.shops.length) : `${happened} z ${line.shops.length} w koszcie`;
  const none = happened === 0 ? '<div class="sub">Żaden sklep się nie odbył — kosztu trasy nie ma.</div>' : "";
  const tie = line.shops.some((shop) => shop.tie) ? '<div class="err">Remis stawek. Rozwiń i wskaż wiersz.</div>' : "";
  const date = anchor
    ? dateInput(
        anchor,
        "route-date",
        line.date ?? "",
        "Zapis od razu. Ta data wchodzi na każdy sklep tej trasy w zestawieniu.",
        line.routeName,
      )
    : DASH;
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
  const shops = targets.filter((item) => item.routeName === line.routeName);
  const pickedShops = shops.filter((item) => screen.commentPicks[item.key] === true).length;
  return (
    `<tr class="${joinClass(rowClass(false, checked, "route"), routeCommentClass(shops.length, pickedShops))}" data-kind="route">` +
    `<td class="c">${lineBox(encodeURIComponent(key), checked)}</td>` +
    `<td>${DASH}</td>` +
    `<td class="adres"><div class="who-line"><button type="button" class="chev" data-action="expand" data-route="${escapeHtml(line.routeName)}" aria-expanded="${open ? "true" : "false"}" aria-label="Sklepy trasy">${open ? "▾" : "▸"}</button>` +
    `<div>${routePick(line.routeName, sub, shops.length, pickedShops)}${none}${tie}</div></div></td>` +
    `<td class="sklep">${DASH}</td>` +
    `<td data-out="route-date">${date}</td>` +
    `<td><span class="tag tag-route">trasa</span></td>` +
    `<td class="num">${rateInput}</td>` +
    `<td class="num"><span>${line.bagCount}</span></td>` +
    `<td class="num">${bagRate}</td>` +
    `<td class="num">${money(line.bagSum, false)}</td>` +
    `<td class="num">${money(line.routeSum, false)}</td>` +
    `<td>${DASH}</td>` +
    routeCommentCell(shops) +
    "</tr>"
  );
}

function childRow(
  screen: StatementScreen,
  shop: ShopCost,
  sharedBagRate: boolean,
  targets: readonly CommentTarget[],
): string {
  const dead = !shop.happened;
  const state = screen.screenByRow[rowKey(shop.sheetRow, shop.transportNumber, shop.sheetName)] ?? {};
  const bagCell = shop.tie || sharedBagRate
    ? DASH
    : amountInput(shop, "bag-rate", state.bagAmount, shop.bagRate, "Kwota tego adresu, tylko ten ekran. Nie zapisuje kolumn rejestru ani Bazy stawek.");
  const target = targets.find((item) => item.key === commentKey(shop));
  return (
    `<tr class="${joinClass(rowClass(dead, false, "child"), shopCommentClass(target, screen))}" data-kind="child">` +
    "<td></td>" +
    `<td>${text(shop.transportNumber, dead)}</td>` +
    shopAddress(shop, dead, target, screen) +
    `<td class="sklep"><div>${text(shop.shopName, dead)}${tieBox(shop.tie, screen.rates)}</div></td>` +
    `<td>${dateInput(shop, "pickup-date", shop.pickupDate, "Zapis od razu do Data odbioru tego sklepu.")}</td>` +
    `<td>${DASH}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td class="num">${bagCountInput(shop, "Zapis od razu do Ilość worków tego adresu")}</td>` +
    `<td class="num">${bagCell}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td class="num">${DASH}</td>` +
    `<td><div class="trip-stack">${tripBox(shop)}${detachButton(shop)}</div></td>` +
    commentCell(shop, target) +
    "</tr>"
  );
}

function commentComposer(screen: StatementScreen, statement: Statement): string {
  const targets = commentTargets(statement, screen.invoiceComments);
  const chosen = chosenComments(targets, screen.commentPicks);
  const hint = overwriteHint(commentsToOverwrite(chosen, screen.commentDraft), screen.commentDraft);
  const summary = selectionSummary(targets, screen.commentPicks);
  const disabled = applyIsDisabled(screen.commentDraft, chosen);
  return (
    '<footer class="composer" data-composer="statement"><div class="composer-bar"><div class="composer-lead">' +
    "<h2>Komentarz dla zaznaczonych</h2>" +
    `<p class="selection-summary${chosen.length === 0 ? " muted" : ""}" data-out="comment-summary">${escapeHtml(summary)}</p></div>` +
    `<textarea data-draft="comment" data-keep="comment" rows="2" placeholder="np. folia osobno, bez PET" aria-label="Komentarz dla zaznaczonych">${escapeHtml(screen.commentDraft)}</textarea>` +
    `<button type="button" class="btn-teal" data-action="apply-comment"${disabled ? " disabled" : ""}>${escapeHtml(applyButtonLabel(screen.commentDraft, chosen))}</button></div>` +
    '<div class="composer-actions">' +
    `<button type="button" class="text-btn" data-action="check-comment-all">${allPicked(targets, screen.commentPicks) ? "odznacz" : "zaznacz wszystkie"}</button></div>` +
    `<p class="note overwrite-hint" data-out="overwrite-hint"${hint ? "" : " hidden"}>${escapeHtml(hint)}</p>` +
    '<p class="note composer-foot">Na tym ekranie. Numer i kwoty bez zmian. Do rejestru jeszcze nie schodzi.</p></footer>'
  );
}

function routePick(routeName: string, sub: string, total: number, picked: number): string {
  if (total === 0) {
    return `<div>${escapeHtml(routeName)}</div><div class="sub">trasa · ${escapeHtml(sub)}</div>`;
  }
  const checked = picked === total ? " checked" : "";
  return (
    `<label class="pick-line"><input type="checkbox" data-pick-route="${escapeHtml(routeName)}" aria-label="${escapeHtml(`Zaznacz sklepy trasy ${routeName}`)}"${checked}>` +
    `<span class="stack"><span>${escapeHtml(routeName)}</span>` +
    `<span class="sub">trasa · ${escapeHtml(sub)} · <span data-route-note="${escapeHtml(routeName)}">${escapeHtml(routePickNote(total, picked))}</span></span></span></label>`
  );
}

function shopAddress(shop: ShopCost, dead: boolean, target: CommentTarget | undefined, screen: StatementScreen): string {
  const shown = text(addressWithCommaAfterLocality(shop.address), dead);
  if (!target) {
    return `<td class="adres">${shown}</td>`;
  }
  const picked = screen.commentPicks[target.key] === true;
  const label = shop.shopName.trim() === "" ? shop.address : shop.shopName;
  return (
    `<td class="adres"><label class="pick-line"><input type="checkbox" data-pick="comment" ${ref(shop)}${picked ? " checked" : ""} aria-label="${escapeHtml(`Zaznacz ${label} do komentarza`)}">` +
    `<span>${shown}</span></label></td>`
  );
}

function commentCell(shop: ShopCost, target: CommentTarget | undefined): string {
  if (!shop.happened || !target) {
    return '<td class="comment-col"><span class="muted" title="Transport się nie odbył. Ten sklep nie wchodzi na fakturę.">—</span></td>';
  }
  return `<td class="comment-col">${commentPlain(target.comment)}</td>`;
}

function routeCommentCell(shops: readonly CommentTarget[]): string {
  if (shops.length === 0) {
    return '<td class="comment-col"><span class="muted">—</span></td>';
  }
  const face = routeCommentFace(shops);
  if (!face.sharedByAll) {
    return `<td class="comment-col"><span class="muted">${escapeHtml(face.sub)}</span></td>`;
  }
  return (
    '<td class="comment-col"><span class="stack">' +
    `<span class="comment-snip">${escapeHtml(face.snip)}</span>` +
    `<span class="sub">${escapeHtml(face.sub)}</span></span></td>`
  );
}

function commentPlain(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? '<span class="muted">brak</span>' : `<span class="comment-snip">${escapeHtml(trimmed)}</span>`;
}

function shopCommentClass(target: CommentTarget | undefined, screen: StatementScreen): string {
  if (!target) {
    return "";
  }
  const picked = screen.commentPicks[target.key] === true;
  if (willOverwrite(target.comment, picked, screen.commentDraft)) {
    return "will-overwrite";
  }
  return picked ? "is-picked" : "";
}

function routeCommentClass(total: number, picked: number): string {
  if (total === 0 || picked === 0) {
    return "";
  }
  return picked === total ? "is-picked" : "is-partial";
}

function joinClass(base: string, extra: string): string {
  return [base, extra].filter(Boolean).join(" ");
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

function selectAllBox(
  lines: readonly StatementLine[],
  selected: StatementScreen["selected"],
  filtered: boolean,
): string {
  const on = lines.length > 0 && lines.every((line) => selected[lineKey(line)] === true);
  const label = filtered ? "Zaznacz widoczne jako rozliczone" : "Zaznacz wszystkie jako rozliczone";
  const disabled = lines.length === 0 ? " disabled" : "";
  return `<input type="checkbox" data-toggle="checked-all"${on ? " checked" : ""}${disabled} aria-label="${label}" title="${label}">`;
}

function lineBox(line: string, checked: boolean): string {
  return `<input type="checkbox" data-toggle="checked" data-line="${escapeHtml(line)}"${checked ? " checked" : ""} aria-label="Rozliczone">`;
}

function tripBox(shop: ShopCost): string {
  const on = !shop.happened;
  return `<label class="trip"><input type="checkbox" data-toggle="notrip" ${ref(shop)}${on ? " checked" : ""}> nie odbył się</label>`;
}

function detachButton(shop: ShopCost): string {
  return `<button type="button" class="btn-detach" data-action="detach" ${ref(shop)} title="Zapis od razu. Sklep schodzi z trasy i zostaje odbiorem za podjazd.">odepnij od trasy</button>`;
}

function newRouteBox(screen: StatementScreen, shop: ShopCost): string {
  const key = rowKey(shop.sheetRow, shop.transportNumber, shop.sheetName);
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

function dateInput(shop: ShopCost, edit: string, shown: string, title: string, routeName?: string): string {
  const route = routeName ? ` data-route="${escapeHtml(routeName)}"` : "";
  return `<input type="date" data-edit="${edit}" ${ref(shop)}${route} value="${escapeHtml(sheetDateInputValue(shown))}" title="${escapeHtml(title)}" aria-label="Data odbioru">`;
}

function sheetDateInputValue(text: string): string {
  if (text === "") {
    return "";
  }
  return calendarToIsoDate(parseSheetDate(text));
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
  return `data-sheet-name="${escapeHtml(shop.sheetName)}" data-sheet-row="${shop.sheetRow}" data-transport="${escapeHtml(shop.transportNumber)}"`;
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
