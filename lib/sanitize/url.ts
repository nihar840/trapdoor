import type { Threat } from "../types";

const MAX_BYTES = 200_000;

export async function fetchUrl(url: string): Promise<{ text: string; safeText: string; htmlComments: string[]; hiddenStyled: string[] }> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("non-http url");
    const res = await fetch(url, {
      headers: { "User-Agent": "TrapdoorScanner/0.1 (+sanitization)" },
      signal: AbortSignal.timeout(8000),
    });
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    const html = raw.slice(0, MAX_BYTES);

    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const visibleText = $("body").text().replace(/\s+/g, " ").trim();

    const htmlComments: string[] = [];
    const commentRe = /<!--([\s\S]*?)-->/g;
    let m;
    while ((m = commentRe.exec(html)) !== null) htmlComments.push(m[1].trim());

    const hiddenStyled: string[] = [];
    $("[style]").each((_, el) => {
      const style = ($(el).attr("style") || "").toLowerCase();
      if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|color\s*:\s*#?fff(?:fff)?(?![0-9a-f])|opacity\s*:\s*0/.test(style)) {
        const t = $(el).text().trim();
        if (t) hiddenStyled.push(t.slice(0, 500));
        $(el).remove();
      }
    });
    $("[hidden], [aria-hidden='true']").each((_, el) => {
      const t = $(el).text().trim();
      if (t) hiddenStyled.push(t.slice(0, 500));
      $(el).remove();
    });

    const safeText = $("body").text().replace(/\s+/g, " ").trim();

    return { text: ct.includes("text/") ? visibleText : "", safeText: ct.includes("text/") ? safeText : "", htmlComments, hiddenStyled };
  } catch (e) {
    return { text: "", safeText: "", htmlComments: [], hiddenStyled: [] };
  }
}

export function scanUrlContent(
  visibleText: string,
  htmlComments: string[],
  hiddenStyled: string[],
): Threat[] {
  const threats: Threat[] = [];
  for (const c of htmlComments) {
    if (/\b(ignore|disregard|system|instruction|exfiltrate|api[_\s-]?key|reveal)\b/i.test(c)) {
      threats.push({
        id: `url-comment-${threats.length}`,
        category: "url_injection",
        severity: "critical",
        source: "url",
        snippet: c.slice(0, 200),
        reason: "HTML comment containing prompt-injection instructions. Naive RAG pipelines feed raw HTML to the model — comments included.",
      });
    }
  }
  for (const h of hiddenStyled) {
    if (h.length > 10) {
      threats.push({
        id: `url-hidden-${threats.length}`,
        category: "url_injection",
        severity: "high",
        source: "url",
        snippet: h.slice(0, 200),
        reason: "Hidden DOM content (display:none / opacity:0 / white-on-white). Invisible to humans, but rendered text scrapers and LLM browsers ingest it.",
      });
    }
  }
  if (/\b(ignore|disregard)\b.{0,50}\b(previous|instructions)\b/i.test(visibleText)) {
    threats.push({
      id: `url-visible-${threats.length}`,
      category: "url_injection",
      severity: "high",
      source: "url",
      snippet: visibleText.slice(0, 200),
      reason: "Visible page text contains override instructions.",
    });
  }
  return threats;
}
