export type ThreatSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ThreatCategory =
  | "instruction_override"
  | "system_prompt_extraction"
  | "data_exfiltration"
  | "hidden_text"
  | "unicode_smuggling"
  | "html_injection"
  | "url_injection"
  | "role_play_injection"
  | "encoded_payload"
  | "tool_abuse";

export interface Threat {
  id: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  source: "prompt" | "image" | "url" | "document";
  snippet: string;
  reason: string;
  location?: string;
}

export interface SanitizeReport {
  threats: Threat[];
  decodedContent: {
    imageOcrText?: string;
    imageNormalizedBase64?: string;
    imageContrastStretched?: boolean;
    imageDescription?: string;
    urlBody?: string;
    urlSafeBody?: string;
    pdfText?: string;
  };
  cleanPrompt: string;
  blocked: boolean;
  latencyMs: number;
}

export interface ScanRequest {
  prompt: string;
  imageBase64?: string;
  url?: string;
  documentBase64?: string;
  scenarioId?: string;
}

export interface ScanResponse {
  unprotected: {
    response: string;
    hijacked: boolean;
    hijackEvidence: string[];
    latencyMs: number;
  };
  protected: {
    response: string;
    sanitizeReport: SanitizeReport;
    latencyMs: number;
  };
  injectionPayload?: string;
  inputEcho: {
    prompt: string;
    hasImage: boolean;
    hasUrl: boolean;
    hasDocument: boolean;
  };
}
