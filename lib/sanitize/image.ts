import type { Threat } from "../types";

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

export async function ocrImage(base64: string): Promise<string> {
  try {
    const worker = await getWorker();
    const buf = Buffer.from(base64.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
    // First pass: raw image
    const { data: d1 } = await worker.recognize(buf);
    const raw = (d1.text || "").trim();

    // Second pass: contrast-stretched copy to surface near-white-on-white injections
    let enhanced = "";
    try {
      const { Jimp } = await import("jimp");
      const img = await Jimp.read(buf);
      img.contrast(0.95).greyscale();
      const png = await img.getBuffer("image/png");
      const { data: d2 } = await worker.recognize(png);
      enhanced = (d2.text || "").trim();
    } catch {}

    // Merge: prefer enhanced if it found materially more text
    if (enhanced && enhanced.length > raw.length + 20) return enhanced;
    if (raw && enhanced) {
      const extra = enhanced.split(/\s+/).filter((w) => !raw.includes(w)).join(" ");
      return extra.length > 10 ? `${raw}\n[low-contrast layer]\n${enhanced}` : raw;
    }
    return raw || enhanced;
  } catch (e) {
    console.error("OCR failed:", e);
    return "";
  }
}

export function scanImageText(text: string): Threat[] {
  if (!text) return [];
  const threats: Threat[] = [];
  if (/\b(ignore|disregard|forget|override)\b/i.test(text) || /system\s+prompt/i.test(text) || /api[_\s-]?key/i.test(text)) {
    threats.push({
      id: `img-hidden-${Date.now()}`,
      category: "hidden_text",
      severity: "critical",
      source: "image",
      snippet: text.slice(0, 200),
      reason: "OCR detected hidden instructions inside the image. Multimodal models read this text just like the prompt — invisible to the user but executed by the model.",
    });
  } else if (text.length > 30) {
    threats.push({
      id: `img-text-${Date.now()}`,
      category: "hidden_text",
      severity: "medium",
      source: "image",
      snippet: text.slice(0, 200),
      reason: "Image contains embedded text that the vision model will interpret. Verify it is intentional.",
    });
  }
  return threats;
}
