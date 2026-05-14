/**
 * Decode common payload encodings adversaries use to slip past text filters.
 *
 * Strategy: scan the input for long-enough runs of each encoding's alphabet,
 * try to decode, and if the decoded bytes look like ASCII text (high
 * printable ratio), include them in the canonical output. Even noisy
 * decodings are useful — heuristics then run on the merged text.
 */

export interface DecodedSpan {
  encoding: "binary" | "hex" | "base64" | "octal" | "decimal_codepoints" | "unicode_escapes";
  source: string;     // the raw matched span
  decoded: string;    // best-effort ASCII decoding
}

const MIN_DECODE_LEN = 12;     // skip noise
const MIN_PRINTABLE_RATIO = 0.7;

function printableRatio(s: string): number {
  if (!s) return 0;
  let p = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) p++;
  }
  return p / s.length;
}

function looksLikeText(s: string): boolean {
  return s.length >= 4 && printableRatio(s) >= MIN_PRINTABLE_RATIO;
}

function decodeBinary(s: string): string {
  // Accept either contiguous 0/1 runs or space-separated 8-bit groups.
  const compact = s.replace(/\s+/g, "");
  if (!/^[01]+$/.test(compact)) return "";
  const usable = compact.slice(0, Math.floor(compact.length / 8) * 8);
  let out = "";
  for (let i = 0; i < usable.length; i += 8) {
    const byte = parseInt(usable.slice(i, i + 8), 2);
    out += String.fromCharCode(byte);
  }
  return out;
}

function decodeHex(s: string): string {
  const compact = s.replace(/[\s:,]/g, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(compact) || compact.length % 2 !== 0) return "";
  let out = "";
  for (let i = 0; i < compact.length; i += 2) {
    out += String.fromCharCode(parseInt(compact.slice(i, i + 2), 16));
  }
  return out;
}

function decodeOctal(s: string): string {
  // Space-separated octal byte groups: 110 105 ...
  const groups = s.trim().split(/\s+/);
  if (groups.length < 3 || !groups.every((g) => /^[0-7]{2,3}$/.test(g))) return "";
  let out = "";
  for (const g of groups) {
    const v = parseInt(g, 8);
    if (v === 0 || v > 255) return "";
    out += String.fromCharCode(v);
  }
  return out;
}

function decodeDecimalCodepoints(s: string): string {
  const groups = s.trim().split(/[\s,]+/);
  if (groups.length < 4 || !groups.every((g) => /^\d{2,4}$/.test(g))) return "";
  let out = "";
  for (const g of groups) {
    const v = parseInt(g, 10);
    if (v === 0 || v > 1114111) return "";
    out += String.fromCodePoint(v);
  }
  return out;
}

function decodeBase64(s: string): string {
  const compact = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return "";
  if (compact.length < 16 || compact.length % 4 !== 0) return "";
  try {
    return Buffer.from(compact, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function decodeUnicodeEscapes(s: string): string {
  // Matches \u00XX or \xXX style sequences.
  return s.replace(/\\u\{?([0-9a-f]{1,6})\}?/gi, (_, hex) => {
    try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; }
  }).replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Find and decode all encoded payload spans in `text`.
 * Returns the original text concatenated with all successful decodings,
 * each labeled so heuristics + the UI can show them.
 */
export function decodeEncodings(text: string): { spans: DecodedSpan[]; merged: string } {
  const spans: DecodedSpan[] = [];

  // Binary: long sequences of 0/1 and whitespace
  for (const m of text.matchAll(/(?:[01]{8}[\s]?){4,}/g)) {
    const src = m[0];
    if (src.replace(/\s/g, "").length < MIN_DECODE_LEN) continue;
    const dec = decodeBinary(src);
    if (looksLikeText(dec)) spans.push({ encoding: "binary", source: src.trim(), decoded: dec });
  }

  // Hex: long sequences of [0-9a-f] possibly grouped
  for (const m of text.matchAll(/(?:0x)?[0-9a-f]{2}(?:[\s:,]?[0-9a-f]{2}){8,}/gi)) {
    const dec = decodeHex(m[0]);
    if (looksLikeText(dec)) spans.push({ encoding: "hex", source: m[0].trim(), decoded: dec });
  }

  // Octal byte groups
  for (const m of text.matchAll(/(?:[0-7]{2,3}\s+){4,}[0-7]{2,3}/g)) {
    const dec = decodeOctal(m[0]);
    if (looksLikeText(dec)) spans.push({ encoding: "octal", source: m[0].trim(), decoded: dec });
  }

  // Decimal codepoint sequences
  for (const m of text.matchAll(/(?:\d{2,4}[\s,]+){4,}\d{2,4}/g)) {
    const dec = decodeDecimalCodepoints(m[0]);
    if (looksLikeText(dec)) spans.push({ encoding: "decimal_codepoints", source: m[0].trim(), decoded: dec });
  }

  // Base64: long [A-Za-z0-9+/=] runs
  for (const m of text.matchAll(/[A-Za-z0-9+/]{20,}={0,2}/g)) {
    const dec = decodeBase64(m[0]);
    if (looksLikeText(dec)) spans.push({ encoding: "base64", source: m[0].trim().slice(0, 60) + (m[0].length > 60 ? "…" : ""), decoded: dec });
  }

  // Unicode escapes
  if (/\\u[0-9a-f]{4}/i.test(text) || /\\x[0-9a-f]{2}/i.test(text)) {
    const dec = decodeUnicodeEscapes(text);
    if (dec !== text && looksLikeText(dec)) {
      spans.push({ encoding: "unicode_escapes", source: "(scattered escapes)", decoded: dec });
    }
  }

  const decodedBlock = spans.length
    ? "\n\n[decoded encoded payloads]\n" +
      spans.map((s) => `(${s.encoding}) ${s.decoded}`).join("\n")
    : "";
  return { spans, merged: text + decodedBlock };
}
