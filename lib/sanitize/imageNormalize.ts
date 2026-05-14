/**
 * Trapdoor image normalization.
 *
 * Goal: surface hidden / faint / low-contrast text that a multimodal LLM
 * could read but a human can't. We make it visible *first*, then OCR.
 *
 * Pipeline (best-effort, all in-memory):
 *  1. Decode to RGBA.
 *  2. Aggressive contrast stretch (per-channel min/max scaling) to expand
 *     the full pixel range to [0, 255]. Near-white-on-white text gets
 *     pushed apart into readable contrast.
 *  3. Greyscale + brightness curve to make low-energy ink stand out.
 *  4. Mild blur removes JPEG ring artifacts that the stretch amplifies.
 *  5. Re-encode as PNG.
 *
 * Returns base64 data-URL of the normalized image, plus a flag indicating
 * whether the normalization actually changed anything visible.
 */

export async function normalizeImage(base64: string): Promise<{
  normalizedBase64: string;
  changed: boolean;
}> {
  try {
    const { Jimp } = await import("jimp");
    const buf = Buffer.from(base64.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
    const img = await Jimp.read(buf);

    // Compute per-channel min/max so we can stretch contrast.
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const data = img.bitmap.data;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
    }
    const span = Math.max(maxR - minR, maxG - minG, maxB - minB);
    // If the image already uses the full range, contrast stretch barely changes it.
    const changed = span < 250;

    // Stretch each channel independently.
    const stretch = (v: number, lo: number, hi: number) => {
      if (hi <= lo) return v;
      return Math.max(0, Math.min(255, Math.round(((v - lo) / (hi - lo)) * 255)));
    };
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = stretch(data[i],     minR, maxR);
      data[i + 1] = stretch(data[i + 1], minG, maxG);
      data[i + 2] = stretch(data[i + 2], minB, maxB);
    }

    // Greyscale + extra contrast bump to highlight ink-like pixels.
    img.greyscale();
    if (typeof (img as any).contrast === "function") (img as any).contrast(0.4);

    // Cap large images so subsequent OCR is fast.
    const maxDim = 1600;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      img.resize({ w: Math.round(w * scale), h: Math.round(h * scale) });
    }

    const png = await img.getBuffer("image/png");
    return {
      normalizedBase64: "data:image/png;base64," + png.toString("base64"),
      changed,
    };
  } catch (e) {
    console.error("normalize failed:", e);
    return { normalizedBase64: base64, changed: false };
  }
}
