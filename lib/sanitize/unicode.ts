import type { Threat } from "../types";

const TAG_RANGE = /[\u{E0000}-\u{E007F}]/gu;
const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩﻿]/g;
const CONFUSABLES_MAP: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p",
  "с": "c", "х": "x", "ԁ": "d", "ԛ": "q",
  "ԝ": "w", "ѕ": "s",
};

export function decodeTagChars(input: string): string {
  let decoded = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xe0020 && cp <= 0xe007e) {
      decoded += String.fromCodePoint(cp - 0xe0000);
    } else if (cp === 0xe0001 || cp === 0xe007f) {
    } else {
      decoded += ch;
    }
  }
  return decoded;
}

export function scanUnicode(text: string, source: Threat["source"]): { threats: Threat[]; clean: string } {
  const threats: Threat[] = [];
  let clean = text;

  if (TAG_RANGE.test(text)) {
    TAG_RANGE.lastIndex = 0;
    const hidden = decodeTagChars(text).replace(text.replace(TAG_RANGE, ""), "").trim();
    threats.push({
      id: `uni-tag-${Date.now()}`,
      category: "unicode_smuggling",
      severity: "critical",
      source,
      snippet: hidden.slice(0, 200) || "[hidden Unicode tag payload]",
      reason: "Unicode tag characters (U+E0020–U+E007E) used to smuggle invisible instructions into the prompt.",
    });
    clean = clean.replace(TAG_RANGE, "");
  }

  if (ZERO_WIDTH.test(text)) {
    threats.push({
      id: `uni-zw-${Date.now()}`,
      category: "unicode_smuggling",
      severity: "medium",
      source,
      snippet: "[zero-width / bidi control characters detected]",
      reason: "Zero-width or bidirectional override characters can hide payloads and confuse parsers.",
    });
    clean = clean.replace(ZERO_WIDTH, "");
  }

  let confusableCount = 0;
  for (const k of Object.keys(CONFUSABLES_MAP)) {
    if (clean.includes(k)) confusableCount++;
  }
  if (confusableCount >= 2) {
    threats.push({
      id: `uni-conf-${Date.now()}`,
      category: "unicode_smuggling",
      severity: "low",
      source,
      snippet: "[cyrillic/latin lookalike characters]",
      reason: "Homoglyph characters (Cyrillic letters disguised as Latin) — common in phishing-style injections.",
    });
    for (const [k, v] of Object.entries(CONFUSABLES_MAP)) {
      clean = clean.split(k).join(v);
    }
  }

  return { threats, clean };
}
