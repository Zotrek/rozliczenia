/**
 * Karta błędu u góry rozliczeń. Nie blokuje strony. Znika po Zamknij.
 * Raport w karcie jest tym samym blokiem, który da się wkleić w czacie.
 */

export interface RozliczeniaErrorReport {
  code: string;
  place: string;
  summary: string;
  effect: string;
  technical: string;
}

export type RozJsonRead =
  | { ok: true; body: unknown }
  | { ok: false; silent: true }
  | { ok: false; silent: false; notJson: true; technical: string };

const CONTINUE = "Możesz dalej pracować w rozliczeniach.";

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function formatRozliczeniaError(report: RozliczeniaErrorReport): string {
  return [
    "ROZLICZENIA-ERROR",
    `kod: ${oneLine(report.code) || "ROZ-E-UNKNOWN"}`,
    `miejsce: ${oneLine(report.place) || "nieznane miejsce"}`,
    `objaw: ${oneLine(report.summary) || "Coś się nie udało."}`,
    `skutek: ${oneLine(report.effect) || "Część danych może być niekompletna."}`,
    `technicznie: ${oneLine(report.technical) || "brak szczegółu"}`,
  ].join("\n");
}

function htmlSnippet(body: string): string {
  const raw = String(body || "");
  let title = "";
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    title = titleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  let text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (title && !text.includes(title)) {
    text = `${title} — ${text}`.trim();
  }
  if (text.length > 280) {
    text = text.slice(0, 280);
  }
  return text;
}

/** Odpowiedź Web App. 401 zostawia overlay logowania. HTML i śmieci to nie-JSON. */
export async function readRozJson(res: { text: () => Promise<string>; status: number }): Promise<RozJsonRead> {
  const text = await res.text();
  let body = String(text ?? "");
  if (body.charCodeAt(0) === 0xfeff) {
    body = body.slice(1);
  }
  body = body.trim();
  if (res.status === 401) {
    return { ok: false, silent: true };
  }
  const first = body.charAt(0);
  if (first === "{" || first === "[") {
    try {
      return { ok: true, body: JSON.parse(body) as unknown };
    } catch {
      /* spada do nie-JSON */
    }
  }
  const snippet = htmlSnippet(body);
  return {
    ok: false,
    silent: false,
    notJson: true,
    technical: `HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`,
  };
}

/** Karta. Bez stosu w HTML zostaje alert z tym samym raportem. */
export function showRozErrorCard(report: RozliczeniaErrorReport): void {
  const summary = oneLine(report.summary) || "Coś się nie udało.";
  const effect = oneLine(report.effect) || "Część danych może być niekompletna.";
  const reportText = formatRozliczeniaError(report);
  const code = oneLine(report.code) || "ROZ-E-UNKNOWN";
  const tell = (globalThis as { alert?: (message: string) => void }).alert;
  if (typeof document === "undefined") {
    tell?.(`${summary}\n${effect}\n${CONTINUE}\n\n${reportText}`);
    return;
  }
  const doc = document;
  const stack = doc.getElementById("roz-error-stack");
  if (!stack) {
    tell?.(`${summary}\n${effect}\n${CONTINUE}\n\n${reportText}`);
    return;
  }
  const card = doc.createElement("article");
  card.className = "roz-error-card";
  card.setAttribute("data-roz-code", code);
  const title = doc.createElement("h2");
  title.className = "roz-error-card-title";
  title.textContent = summary;
  const effectEl = doc.createElement("p");
  effectEl.className = "roz-error-card-effect";
  effectEl.textContent = effect;
  const continueEl = doc.createElement("p");
  continueEl.className = "roz-error-card-continue";
  continueEl.textContent = CONTINUE;
  const label = doc.createElement("label");
  label.className = "roz-error-card-label";
  label.textContent = "Raport do wklejenia w czacie";
  const field = doc.createElement("textarea");
  field.className = "roz-error-card-report";
  field.readOnly = true;
  field.spellcheck = false;
  field.rows = 6;
  field.value = reportText;
  label.appendChild(field);
  const actions = doc.createElement("div");
  actions.className = "roz-error-card-actions";
  const copyBtn = doc.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "roz-error-card-copy";
  copyBtn.textContent = "Kopiuj raport";
  const closeBtn = doc.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "roz-error-card-dismiss";
  closeBtn.textContent = "Zamknij";
  const markCopy = (ok: boolean): void => {
    copyBtn.textContent = ok ? "Skopiowano" : "Zaznaczono — skopiuj ręcznie";
  };
  copyBtn.addEventListener("click", () => {
    field.focus();
    field.select();
    const text = field.value || "";
    let copied = false;
    try {
      copied = doc.execCommand("copy");
    } catch {
      copied = false;
    }
    if (copied) {
      markCopy(true);
      return;
    }
    const clipboard = navigator.clipboard;
    if (clipboard && clipboard.writeText) {
      clipboard
        .writeText(text)
        .then(() => {
          markCopy(true);
        })
        .catch(() => {
          markCopy(false);
        });
      return;
    }
    markCopy(false);
  });
  closeBtn.addEventListener("click", () => {
    if (card.parentNode) {
      card.parentNode.removeChild(card);
    }
    if (!stack.querySelector(".roz-error-card")) {
      stack.hidden = true;
    }
  });
  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);
  card.appendChild(title);
  card.appendChild(effectEl);
  card.appendChild(continueEl);
  card.appendChild(label);
  card.appendChild(actions);
  stack.appendChild(card);
  stack.hidden = false;
}

export function showRozFailure(
  report: { code: string; place: string; summary: string; effect: string },
  detail: { technical: string; notJson?: boolean; error?: unknown; status?: number },
): void {
  if (detail.status === 401 || detail.error === "unauthorized" || detail.error === "proxy_auth_mismatch") {
    return;
  }
  showRozErrorCard({
    code: detail.notJson ? "ROZ-E-NOT-JSON" : report.code,
    place: report.place,
    summary: report.summary,
    effect: report.effect,
    technical: detail.technical,
  });
}

const host = globalThis as typeof globalThis & { showRozErrorCard?: typeof showRozErrorCard };
host.showRozErrorCard = showRozErrorCard;
