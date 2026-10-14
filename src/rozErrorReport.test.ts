import { describe, expect, it } from "vitest";
import { formatRozliczeniaError, readRozJson, showRozFailure } from "./rozErrorReport.js";

describe("formatRozliczeniaError", () => {
  it("test_formatRozliczeniaError_clipboard_block_collapses_whitespace", () => {
    const text = formatRozliczeniaError({
      code: "ROZ-E-SEARCH",
      place: "page.ts runSearch",
      summary: "Wyszukanie\nnie doszło.",
      effect: "Zestawienie się nie zmieniło.",
      technical: "Failed to fetch",
    });
    expect(text).toBe(
      [
        "ROZLICZENIA-ERROR",
        "kod: ROZ-E-SEARCH",
        "miejsce: page.ts runSearch",
        "objaw: Wyszukanie nie doszło.",
        "skutek: Zestawienie się nie zmieniło.",
        "technicznie: Failed to fetch",
      ].join("\n"),
    );
  });
});

describe("readRozJson", () => {
  it("test_readRozJson_json_401_and_html", async () => {
    const json = await readRozJson({
      status: 200,
      text: async () => '{"ok":true}',
    });
    expect(json).toEqual({ ok: true, body: { ok: true } });

    const denied = await readRozJson({
      status: 401,
      text: async () => "nope",
    });
    expect(denied).toEqual({ ok: false, silent: true });

    const html = await readRozJson({
      status: 500,
      text: async () => "<html><title>Limit</title><body>za dużo</body></html>",
    });
    expect(html.ok).toBe(false);
    if (!html.ok && !html.silent) {
      expect(html.notJson).toBe(true);
      expect(html.technical).toContain("HTTP 500");
      expect(html.technical).toContain("Limit");
      expect(html.technical).toContain("za dużo");
    }
  });
});

describe("showRozFailure", () => {
  it("test_showRozFailure_skips_session_and_marks_not_json", () => {
    const alerts: string[] = [];
    const host = globalThis as { alert?: (message: string) => void };
    const previous = host.alert;
    host.alert = (message) => {
      alerts.push(message);
    };
    try {
      const report = {
        code: "ROZ-E-WRITE",
        place: "page.ts writeNow",
        summary: "Zapis nie doszedł.",
        effect: "Reszta zestawienia zostaje.",
      };
      showRozFailure(report, { technical: "x", error: "unauthorized" });
      showRozFailure(report, { technical: "x", error: "proxy_auth_mismatch" });
      showRozFailure(report, { technical: "HTTP 502: brama", notJson: true });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toContain("ROZLICZENIA-ERROR");
      expect(alerts[0]).toContain("kod: ROZ-E-NOT-JSON");
      expect(alerts[0]).toContain("technicznie: HTTP 502: brama");
      expect(alerts[0]).toContain("Możesz dalej pracować w rozliczeniach.");
    } finally {
      host.alert = previous;
    }
  });
});
