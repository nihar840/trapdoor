import type { Threat, ThreatCategory, ThreatSeverity } from "../types";

interface Rule {
  category: ThreatCategory;
  severity: ThreatSeverity;
  pattern: RegExp;
  reason: string;
}

const RULES: Rule[] = [
  {
    category: "instruction_override",
    severity: "critical",
    pattern: /\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|earlier|the\s+system|your)\s+(instructions?|prompts?|rules?|guidelines?|directives?)/i,
    reason: "Classic instruction-override pattern attempting to discard prior system constraints.",
  },
  {
    category: "system_prompt_extraction",
    severity: "high",
    pattern: /\b(reveal|show|print|output|repeat|tell\s+me)\s+(your|the)\s+(system|initial|hidden|original|secret)\s+(prompt|instructions?|message|rules)/i,
    reason: "Attempt to extract the system prompt or hidden instructions.",
  },
  {
    category: "role_play_injection",
    severity: "high",
    pattern: /\b(you are now|pretend to be|act as|roleplay as|from now on you are|new persona|DAN|do anything now|jailbreak)\b/i,
    reason: "Role-redefinition pattern used to escape the assistant's policy.",
  },
  {
    category: "data_exfiltration",
    severity: "critical",
    pattern: /!\[[^\]]*\]\(https?:\/\/[^\)]*\?[^)]*=[^)]*\)/,
    reason: "Markdown image with query parameters — a known exfiltration channel that smuggles data via image URL.",
  },
  {
    category: "data_exfiltration",
    severity: "high",
    pattern: /<img[^>]+src=["']?https?:\/\/[^"' >]+\?[^"' >]*[A-Z_]+=/i,
    reason: "HTML image tag with query parameters can exfiltrate context via the URL.",
  },
  {
    category: "encoded_payload",
    severity: "medium",
    pattern: /\b[A-Za-z0-9+/]{60,}={0,2}\b/,
    reason: "Long base64-looking string — may hide an instruction payload.",
  },
  {
    category: "tool_abuse",
    severity: "high",
    pattern: /\b(call|invoke|execute|run)\s+(tool|function|api)\s*[:=]?\s*["']?(delete|drop|exfil|send|email|webhook)/i,
    reason: "Direct tool-invocation pattern targeting destructive or exfiltrating functions.",
  },
  {
    category: "instruction_override",
    severity: "high",
    pattern: /\b(end\s+of\s+(user\s+)?(prompt|input|message)|<\/(user|prompt|system)>|---\s*end|new\s+instructions?\s+below)/i,
    reason: "Boundary-spoofing tokens attempting to fake the end of the user message and inject new instructions.",
  },
  {
    category: "system_prompt_extraction",
    severity: "medium",
    pattern: /\b(api[_\s-]?key|secret|password|token|credentials?)\b.{0,40}\b(reveal|show|print|leak|share|send)/i,
    reason: "Request to disclose credentials or secrets.",
  },
];

export function scanHeuristics(text: string, source: Threat["source"]): Threat[] {
  const threats: Threat[] = [];
  RULES.forEach((rule, idx) => {
    const m = text.match(rule.pattern);
    if (m) {
      const start = Math.max(0, (m.index ?? 0) - 20);
      const end = Math.min(text.length, (m.index ?? 0) + m[0].length + 20);
      threats.push({
        id: `h-${source}-${idx}-${start}`,
        category: rule.category,
        severity: rule.severity,
        source,
        snippet: text.slice(start, end),
        reason: rule.reason,
      });
    }
  });
  return threats;
}
