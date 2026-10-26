import { describe, expect, it } from "vitest";
import { rowKey } from "./engine.js";
import {
  COMMENT_NEEDS_TEXT,
  applyButtonLabel,
  applyComments,
  applyIsDisabled,
  commentApplyNotice,
  commentTargets,
  commentsToOverwrite,
  invoiceCommentTargets,
  invoiceSelectionSummary,
  openingCommentPicks,
  overwriteHint,
  retainInvoiceComment,
  routeCommentFace,
  routePickNote,
  selectionSummary,
  emptyInvoiceComment,
  type CommentTarget,
} from "./invoiceComment.js";
import type { SettledInvoiceRow } from "./invoices.js";
import type { ShopCost, Statement } from "./types.js";

function shop(over: Partial<ShopCost> & { sheetRow: number }): ShopCost {
  return {
    sheetName: "",
    transportNumber: String(over.sheetRow),
    address: "adres",
    shopName: "Sklep",
    pickupDate: "18.10.2026",
    bagCount: 1,
    happened: true,
    legAmount: 0,
    bagRate: 0,
    bagSum: 0,
    receptionCost: 0,
    costPerBag: 0,
    tie: null,
    ...over,
  };
}

function statement(targets: { route?: ShopCost[]; plain?: ShopCost[] }): Statement {
  const lines: Statement["lines"] = [];
  if (targets.route) {
    lines.push({
      kind: "route",
      routeName: "Trasa Wybrzeże",
      date: "18.10.2026",
      routeRate: 0,
      routeCostApplies: true,
      bagCount: 1,
      bagRate: 0,
      bagSum: 0,
      routeSum: 0,
      shops: targets.route,
    });
  }
  for (const plain of targets.plain ?? []) {
    lines.push({ kind: "plain", shop: plain });
  }
  return { lines, total: 0, ties: [] };
}

function invoiceRow(over: Partial<SettledInvoiceRow> & { sheetRow: number }): SettledInvoiceRow {
  return {
    sheetName: "",
    transportNumber: String(over.sheetRow),
    address: "adres",
    shopName: "Sklep",
    pickupDate: "18.10.2026",
    contractor: "gpw",
    bagCount: 1,
    routeName: "",
    invoice: "FV/1",
    receptionCost: 0,
    costPerBag: 0,
    ...over,
  };
}

describe("commentTargets", () => {
  it("test_openingCommentPicks_takes_empty_route_shops_and_leaves_own_comment_and_pickups", () => {
    const deb = shop({ sheetRow: 4, shopName: "Dębogórska" });
    const dead = shop({ sheetRow: 5, shopName: "Martwy", happened: false });
    const screen = statement({
      route: [
        shop({ sheetRow: 2, shopName: "Świętojańska" }),
        shop({ sheetRow: 3, shopName: "Sobieskiego" }),
        deb,
        dead,
      ],
      plain: [
        shop({ sheetRow: 6, shopName: "Zwoleń" }),
        shop({ sheetRow: 7, shopName: "Gdańsk" }),
        shop({ sheetRow: 8, shopName: "Żukowo" }),
      ],
    });
    const comments = { [rowKey(4, "4")]: "Odbiór po 16:00, brama od podwórza" };
    const targets = commentTargets(screen, comments);
    expect(targets.map((item) => item.shopName)).toEqual([
      "Świętojańska",
      "Sobieskiego",
      "Dębogórska",
      "Zwoleń",
      "Gdańsk",
      "Żukowo",
    ]);
    const picks = openingCommentPicks(targets);
    expect(Object.keys(picks)).toEqual([rowKey(2, "2"), rowKey(3, "3")]);
    expect(selectionSummary(targets, picks)).toBe("Zaznaczone: 2 sklepy · Trasa Wybrzeże.");
  });

  it("test_selectionSummary_joins_pickups_after_the_route", () => {
    const targets = commentTargets(
      statement({
        route: [shop({ sheetRow: 2, shopName: "Świętojańska" })],
        plain: [shop({ sheetRow: 6, shopName: "Zwoleń" }), shop({ sheetRow: 7, shopName: "Gdańsk" })],
      }),
      {},
    );
    const picks: Record<string, true> = {};
    for (const target of targets) {
      picks[target.key] = true;
    }
    expect(selectionSummary(targets, picks)).toBe("Zaznaczone: 1 sklep · Trasa Wybrzeże i 2 podjazdy.");
    expect(selectionSummary(targets, {})).toBe("Nic nie zaznaczono. Zaznacz trasę, sklep w trasie albo podjazd.");
  });

  it("test_overwriteHint_names_a_shop_with_a_different_comment_and_counts_past_three", () => {
    const chosen: CommentTarget[] = [
      { key: "a", shopName: "Dębogórska", routeName: "Trasa Wybrzeże", comment: "własny" },
      { key: "b", shopName: "Drugi", routeName: null, comment: "" },
    ];
    expect(overwriteHint(commentsToOverwrite(chosen, "nowy"), "nowy")).toBe(
      "Nadpisze istniejący komentarz: Dębogórska.",
    );
    expect(overwriteHint(commentsToOverwrite(chosen, ""), "")).toBe(
      "Wyczyści istniejący komentarz: Dębogórska.",
    );
    expect(overwriteHint(commentsToOverwrite(chosen, "własny"), "własny")).toBe("");
    const many = [1, 2, 3, 4].map((sheetRow) => ({
      key: String(sheetRow),
      shopName: `S${sheetRow}`,
      comment: "stary",
    }));
    expect(overwriteHint(many, "nowy")).toBe("Nadpisze istniejący komentarz przy 4 pozycjach.");
  });

  it("test_applyComments_writes_one_text_and_clears_only_when_something_is_there", () => {
    const chosen = [
      { key: "a", shopName: "A", comment: "" },
      { key: "b", shopName: "B", comment: "stary" },
    ];
    expect(applyComments({ b: "stary" }, chosen, "  folia  ")).toEqual({ a: "folia", b: "folia" });
    expect(applyComments({ b: "stary" }, chosen, "   ")).toEqual({});
    expect(applyComments({}, [chosen[0]], "  ")).toBeNull();
    expect(applyIsDisabled("  ", [chosen[0]])).toBe(true);
    expect(applyIsDisabled("", chosen)).toBe(false);
    expect(applyButtonLabel("folia", chosen)).toBe("Wpisz na zaznaczone (2)");
    expect(applyButtonLabel("", chosen)).toBe("Wyczyść na zaznaczonych (2)");
    expect(commentApplyNotice(2, "folia", "statement")).toBe("Wpisane przy 2 pozycjach.");
    expect(commentApplyNotice(1, "", "invoice")).toBe("Wyczyszczone przy 1 pozycji tej faktury.");
    expect(COMMENT_NEEDS_TEXT).toContain("Wpisz komentarz");
  });

  it("test_routeCommentFace_says_when_the_route_shares_one_text", () => {
    expect(routeCommentFace([{ key: "a", shopName: "A", comment: "" }]).sub).toBe("brak komentarza");
    expect(
      routeCommentFace([
        { key: "a", shopName: "A", comment: "folia" },
        { key: "b", shopName: "B", comment: "folia" },
      ]),
    ).toEqual({ snip: "folia", sub: "ten sam przy 2 sklepach", sharedByAll: true });
    expect(
      routeCommentFace([
        { key: "a", shopName: "A", comment: "folia" },
        { key: "b", shopName: "B", comment: "" },
      ]).sub,
    ).toBe("przy 1 z 2");
    expect(
      routeCommentFace([
        { key: "a", shopName: "A", comment: "folia" },
        { key: "b", shopName: "B", comment: "pet" },
      ]).sub,
    ).toBe("różne · 2 z 2");
    expect(routePickNote(3, 0)).toBe("zaznaczenie trasy bierze jej sklepy");
    expect(routePickNote(3, 3)).toBe("zaznaczone wszystkie sklepy");
    expect(routePickNote(3, 2)).toBe("zaznaczone 2 z 3");
  });

  it("test_invoiceSelectionSummary_counts_positions_and_keeps_text_for_rows_that_stay", () => {
    expect(invoiceSelectionSummary(0)).toBe("Nic nie zaznaczono. Zaznacz pozycje w tabeli.");
    expect(invoiceSelectionSummary(2)).toBe("Zaznaczone: 2 pozycje.");
    const rows = [invoiceRow({ sheetRow: 2, shopName: "A" }), invoiceRow({ sheetRow: 3, shopName: "B" })];
    const comments = { [rowKey(2, "2")]: "folia", [rowKey(9, "9")]: "znika" };
    expect(invoiceCommentTargets(rows, comments).map((item) => item.comment)).toEqual(["folia", ""]);
    const kept = retainInvoiceComment(
      { ...emptyInvoiceComment(), comments, picks: { [rowKey(2, "2")]: true, [rowKey(9, "9")]: true }, draft: "x", notice: "stare" },
      rows,
    );
    expect(kept.comments).toEqual({ [rowKey(2, "2")]: "folia" });
    expect(kept.picks).toEqual({ [rowKey(2, "2")]: true });
    expect(kept.draft).toBe("x");
    expect(kept.notice).toBe("");
  });
});
