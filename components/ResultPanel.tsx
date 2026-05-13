"use client";
import type { ScanResponse } from "@/lib/types";
import { Shield, ShieldOff, Clock, AlertOctagon, CheckCircle2, ChevronDown, EyeOff } from "lucide-react";
import { ThreatCard } from "./ThreatBadge";
import { useState } from "react";

interface Props {
  data: ScanResponse | null;
  loading: boolean;
}

export function ResultPanel({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div className="grid md:grid-cols-2 gap-4 animate-fade-in">
        <PanelSkeleton kind="raw" />
        <PanelSkeleton kind="safe" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="animate-slide-up">
      {data.injectionPayload && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 flex gap-3 items-start">
          <EyeOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed">
            <span className="text-amber-500 font-semibold uppercase tracking-wider text-[10px] mr-2">hidden payload</span>
            <span className="text-ink-200">{data.injectionPayload}</span>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <UnprotectedPanel data={data} />
        <ProtectedPanel data={data} />
      </div>
      <DetailsRow data={data} />
    </div>
  );
}

function PanelSkeleton({ kind }: { kind: "raw" | "safe" }) {
  const isRaw = kind === "raw";
  return (
    <div className={`rounded-2xl border ${isRaw ? "border-danger-500/30" : "border-safe-500/30"} bg-ink-900/40 p-5 h-80 animate-pulse`}>
      <div className="h-4 w-32 bg-ink-800 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-ink-800 rounded w-full" />
        <div className="h-3 bg-ink-800 rounded w-5/6" />
        <div className="h-3 bg-ink-800 rounded w-4/6" />
      </div>
    </div>
  );
}

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const escaped = terms
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-danger-500/30 text-danger-500 px-1 rounded font-bold border border-danger-500/50">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function UnprotectedPanel({ data }: { data: ScanResponse }) {
  const hijacked = data.unprotected.hijacked;
  const raw = data.unprotected.response;
  const simulated = raw.startsWith("[simulated");
  const stripped = raw.replace(/^\[simulated[^\]]*\]\n+/, "");
  const modelLabel = simulated ? (raw.match(/^\[(simulated[^\]]*)\]/)?.[1] || "simulated") : "claude-haiku-4-5";

  return (
    <div className={`rounded-2xl border ${hijacked ? "border-danger-500/60 bg-danger-500/[0.04]" : "border-ink-800 bg-ink-900/40"} p-5 flex flex-col`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ShieldOff className={`w-5 h-5 ${hijacked ? "text-danger-500" : "text-ink-400"}`} />
          <h3 className="font-semibold text-ink-100">Without Trapdoor</h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-ink-400">
          <Clock className="w-3 h-3" />
          {data.unprotected.latencyMs}ms
        </div>
      </div>
      <div className="text-[10px] text-ink-600 mb-3 font-mono">model: {modelLabel}</div>

      {hijacked && (
        <div className="mb-3 flex items-center gap-2 text-danger-500 text-[12px] font-semibold">
          <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
          Output hijacked — the injection won, the user's question was ignored
        </div>
      )}

      <div className="flex-1 text-[13px] text-ink-100 whitespace-pre-wrap leading-relaxed bg-ink-950/70 rounded-lg p-4 border border-ink-800 min-h-[180px] max-h-[420px] overflow-auto scrollbar-thin">
        {highlight(stripped, data.unprotected.hijackEvidence)}
      </div>
    </div>
  );
}

function ProtectedPanel({ data }: { data: ScanResponse }) {
  const r = data.protected.sanitizeReport;
  return (
    <div className="rounded-2xl border border-safe-500/60 bg-safe-500/[0.04] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-safe-500" />
          <h3 className="font-semibold text-ink-100">With Trapdoor</h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-ink-400">
          <Clock className="w-3 h-3" />
          {data.protected.latencyMs}ms · +{r.latencyMs}ms scan
        </div>
      </div>
      <div className="text-[10px] text-ink-600 mb-3 font-mono">model: claude-haiku-4-5</div>

      <div className="mb-3 flex items-center gap-2 text-safe-500 text-[12px] font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Injection stripped — model answered the user's actual question
      </div>

      <div className="flex-1 text-[13px] text-ink-100 whitespace-pre-wrap leading-relaxed bg-ink-950/70 rounded-lg p-4 border border-ink-800 min-h-[180px] max-h-[420px] overflow-auto scrollbar-thin">
        {data.protected.response}
      </div>
    </div>
  );
}

function DetailsRow({ data }: { data: ScanResponse }) {
  const [open, setOpen] = useState(false);
  const r = data.protected.sanitizeReport;
  const hasDecoded = r.decodedContent.imageOcrText || r.decodedContent.urlBody || r.decodedContent.pdfText;
  if (r.threats.length === 0 && !hasDecoded) return null;

  return (
    <div className="mt-4 rounded-2xl border border-ink-800 bg-ink-900/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-ink-200 hover:bg-ink-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">How Trapdoor caught it</span>
          <span className="text-[11px] text-ink-400">
            {r.threats.length} detection{r.threats.length === 1 ? "" : "s"} · {Object.values(r.decodedContent).filter(Boolean).length} channel{Object.values(r.decodedContent).filter(Boolean).length === 1 ? "" : "s"} scanned
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-800 grid md:grid-cols-2 gap-4">
          {r.threats.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2 font-medium">Detections</div>
              <div className="space-y-2 max-h-72 overflow-auto scrollbar-thin pr-1">
                {r.threats.map((t) => <ThreatCard key={t.id} threat={t} />)}
              </div>
            </div>
          )}
          {hasDecoded && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2 font-medium">Decoded untrusted content</div>
              <div className="space-y-2 text-[11px] font-mono max-h-72 overflow-auto scrollbar-thin pr-1">
                {r.decodedContent.imageOcrText && (
                  <div className="bg-ink-950 border border-ink-800 rounded p-2">
                    <div className="text-ink-400 mb-1">image OCR:</div>
                    <div className="text-ink-200 whitespace-pre-wrap">{r.decodedContent.imageOcrText}</div>
                  </div>
                )}
                {r.decodedContent.urlBody && (
                  <div className="bg-ink-950 border border-ink-800 rounded p-2">
                    <div className="text-ink-400 mb-1">URL content (raw, including hidden):</div>
                    <div className="text-ink-200 whitespace-pre-wrap">{r.decodedContent.urlBody}</div>
                  </div>
                )}
                {r.decodedContent.pdfText && (
                  <div className="bg-ink-950 border border-ink-800 rounded p-2">
                    <div className="text-ink-400 mb-1">PDF text:</div>
                    <div className="text-ink-200 whitespace-pre-wrap">{r.decodedContent.pdfText}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
