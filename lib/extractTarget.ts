/**
 * Given the text Trapdoor recovered from an attachment (OCR, URL content,
 * PDF text), find the phrase the injection is trying to force the model to
 * say. We use this on the unprotected-side demo to show what a weaker model
 * *would* have replied with if it had obeyed the injection.
 */
export function extractInjectionTarget(text: string): string | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    /reply\s+(?:only\s+)?with(?:\s+the\s+exact\s+phrase)?[:\s]+["'“”']?([^"'“”'\n]{2,140}?)["'“”']?(?:\.|\n|$)/i,
    /respond\s+(?:only\s+)?with(?:\s+the\s+exact\s+phrase)?[:\s]+["'“”']?([^"'“”'\n]{2,140}?)["'“”']?(?:\.|\n|$)/i,
    /answer\s+(?:only\s+)?with[:\s]+["'“”']?([^"'“”'\n]{2,140}?)["'“”']?(?:\.|\n|$)/i,
    /say\s+(?:only\s+)?[:\s]*["'“”']([^"'“”'\n]{2,140}?)["'“”']/i,
    /the\s+exact\s+phrase[:\s]+["'“”']?([^"'“”'\n]{2,140}?)["'“”']?(?:\.|\n|$)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      return m[1].trim().replace(/[\s.'"!?,;:]+$/g, "");
    }
  }
  return null;
}
