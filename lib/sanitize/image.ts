import type { Threat } from "../types";
import { visionExtractAllText, visionCaption } from "./visionOcr";
import { normalizeImage } from "./imageNormalize";

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

export interface ImageScan {
  originalBase64: string;
  normalizedBase64: string;
  /** True if normalization changed the pixel range materially (contrast was stretched). */
  contrastStretched: boolean;
  ocrText: string;
  caption: {
    description: string;
    visibleText: string;
    suspiciousText: string;
  };
}

/**
 * Full image inspection: normalize → OCR (tesseract + vision on both
 * original and normalized) → caption.
 */
export async function inspectImage(base64: string): Promise<ImageScan> {
  const { normalizedBase64, changed } = await normalizeImage(base64);

  const [tessOrig, tessNorm, visionAll, caption] = await Promise.all([
    tesseractOcr(base64),
    tesseractOcr(normalizedBase64),
    visionExtractAllText(normalizedBase64),
    visionCaption(base64),
  ]);

  const parts: string[] = [];
  if (caption.visibleText) parts.push(`[visible text]\n${caption.visibleText}`);
  else if (tessOrig) parts.push(`[visible text (tesseract on original)]\n${tessOrig}`);
  if (caption.suspiciousText) parts.push(`[suspicious / faint / hidden text]\n${caption.suspiciousText}`);
  if (visionAll && !parts.some((p) => p.includes(visionAll.slice(0, 40)))) {
    parts.push(`[full text on contrast-stretched image]\n${visionAll}`);
  }
  if (tessNorm && tessNorm.length > 20 && !parts.some((p) => p.includes(tessNorm.slice(0, 40)))) {
    parts.push(`[tesseract on contrast-stretched image]\n${tessNorm}`);
  }

  return {
    originalBase64: base64,
    normalizedBase64,
    contrastStretched: changed,
    ocrText: parts.join("\n\n").trim(),
    caption,
  };
}

export function scanImageText(text: string): Threat[] {
  if (!text) return [];
  const threats: Threat[] = [];

  const hasInjectionMarkers =
    /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|instructions?|prompts?)/i.test(text) ||
    /\b(reveal|leak|disclose|print)\b.{0,40}\b(system\s+prompt|api[_\s-]?key|secret|password)/i.test(text) ||
    /\b(agent\s+note|admin\s+override|system\s*:|priority\s*])/i.test(text) ||
    /\breply\s+(only\s+)?(with|using)\s+["']?[^"'\n]{1,80}["']?/i.test(text) ||
    /\byou\s+are\s+now\b/i.test(text);
  const inFaintLayer = /\[suspicious|faint|hidden|low-contrast|stretched/i.test(text);

  if (hasInjectionMarkers) {
    threats.push({
      id: `img-inj-${Date.now()}`,
      category: "hidden_text",
      severity: "critical",
      source: "image",
      snippet: text.slice(0, 250),
      reason: inFaintLayer
        ? "Trapdoor contrast-normalized the image and recovered hidden text containing prompt-injection instructions. A multimodal model would read these as commands."
        : "OCR detected prompt-injection instructions embedded in the image. A multimodal model reads this text as if you typed it.",
    });
  } else if (inFaintLayer && text.replace(/\[[^\]]+\]/g, "").trim().length > 15) {
    threats.push({
      id: `img-faint-${Date.now()}`,
      category: "hidden_text",
      severity: "medium",
      source: "image",
      snippet: text.slice(0, 250),
      reason: "Trapdoor's contrast normalization revealed a faint text layer not visible at normal viewing. No injection keywords matched, but inspect manually.",
    });
  } else if (text.length > 30) {
    threats.push({
      id: `img-text-${Date.now()}`,
      category: "hidden_text",
      severity: "info",
      source: "image",
      snippet: text.slice(0, 200),
      reason: "Image contains embedded text. Vision models will read it as part of the prompt context.",
    });
  }
  return threats;
}
