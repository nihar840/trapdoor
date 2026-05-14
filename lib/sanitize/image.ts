import type { Threat } from "../types";
import { visionOcr } from "./visionOcr";

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

async function tesseractOcr(base64: string): Promise<string> {
  try {
    const worker = await getWorker();
    const buf = Buffer.from(base64.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
    const { data } = await worker.recognize(buf);
    return (data.text || "").trim();
  } catch {
    return "";
  }
}

/**
 * Two-engine OCR:
 *  - tesseract for fast, free local OCR of clearly-rendered text
 *  - Claude vision as a second pass that reliably picks up faint /
 *    low-contrast / hidden text that tesseract misses.
 * Results are merged and labeled.
 */
export async function ocrImage(base64: string): Promise<string> {
  const [tess, vision] = await Promise.all([
    tesseractOcr(base64),
    visionOcr(base64),
  ]);

  const parts: string[] = [];
  if (vision.visible) parts.push(`[visible text]\n${vision.visible}`);
  else if (tess) parts.push(`[visible text]\n${tess}`);
  if (vision.faint) parts.push(`[faint / low-contrast / hidden text]\n${vision.faint}`);
  return parts.join("\n\n").trim();
}

export function scanImageText(text: string): Threat[] {
  if (!text) return [];
  const threats: Threat[] = [];
  const hasInjectionMarkers =
    /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|instructions?)/i.test(text) ||
    /system\s+prompt/i.test(text) ||
    /\b(agent\s+note|admin\s+override|system\s*:|priority\s*])\b/i.test(text) ||
    /reply\s+(only\s+)?(with|using)\s+["']?[^"'\n]{1,80}["']?/i.test(text);
  const inFaintLayer = /\[faint|hidden|low-contrast/i.test(text);

  if (hasInjectionMarkers) {
    threats.push({
      id: `img-hidden-${Date.now()}`,
      category: "hidden_text",
      severity: "critical",
      source: "image",
      snippet: text.slice(0, 250),
      reason: inFaintLayer
        ? "Vision OCR recovered low-contrast / near-invisible text in the image containing prompt-injection instructions. Multimodal models read this text as if you typed it."
        : "OCR detected prompt-injection instructions inside the image. Multimodal models read this text as if you typed it.",
    });
  } else if (inFaintLayer) {
    threats.push({
      id: `img-faint-${Date.now()}`,
      category: "hidden_text",
      severity: "medium",
      source: "image",
      snippet: text.slice(0, 250),
      reason: "Image contains a faint or low-contrast text layer invisible at normal viewing. Worth inspecting even if no injection pattern matched.",
    });
  } else if (text.length > 30) {
    threats.push({
      id: `img-text-${Date.now()}`,
      category: "hidden_text",
      severity: "info",
      source: "image",
      snippet: text.slice(0, 200),
      reason: "Image contains embedded text that the vision model will interpret. Verify it is intentional.",
    });
  }
  return threats;
}
