import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html.js";

describe("escapeHtml", () => {
  it("test_escapeHtml_amp_lt_gt_quote", () => {
    expect(escapeHtml(`a&b<c>d"e`)).toBe("a&amp;b&lt;c&gt;d&quot;e");
  });

  it("test_escapeHtml_plain_text_unchanged", () => {
    expect(escapeHtml("Sklepowa 1")).toBe("Sklepowa 1");
  });

  it("test_escapeHtml_empty_string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("test_escapeHtml_ampersand_first_so_entities_are_not_double_escaped", () => {
    expect(escapeHtml("&<>\"")).toBe("&amp;&lt;&gt;&quot;");
  });
});
