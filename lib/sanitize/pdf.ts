import type { Threat } from "../types";

export async function extractPdfText(base64: string): Promise<string> {
  try {
    const buf = Buffer.from(base64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    const mod = await import("pdf-parse");
    const pdfParse = (mod as any).default || mod;
    const data = await pdfParse(buf);
    return (data.text || "").trim();
  } catch (e) {
    return "";
  }
}

export function scanPdfText(text: string): Threat[] {
  if (!text) return [];
  const threats: Threat[] = [];
  if (/\b(ignore|disregard|override)\b.{0,40}\b(instructions|prompt|system)\b/i.test(text) ||
      /\b(reveal|leak|exfil)\b.{0,40}\b(system\s+prompt|api[_\s-]?key|secret)\b/i.test(text)) {
    threats.push({
      id: `pdf-inj-${Date.now()}`,
      category: "html_injection",
      severity: "critical",
      source: "document",
      snippet: text.slice(0, 200),
      reason: "PDF text layer contains prompt-injection instructions. Document RAG pipelines feed this directly to the LLM.",
    });
  }
  return threats;
}
