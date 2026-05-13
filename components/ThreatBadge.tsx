import type { Threat, ThreatSeverity } from "@/lib/types";
import { AlertTriangle, ShieldAlert, Info, AlertOctagon } from "lucide-react";

const STYLES: Record<ThreatSeverity, { bg: string; fg: string; icon: any; label: string }> = {
  info:     { bg: "bg-ink-800",            fg: "text-ink-200",   icon: Info,         label: "info" },
  low:     { bg: "bg-amber-500/10",        fg: "text-amber-500", icon: Info,         label: "low" },
  medium:  { bg: "bg-amber-500/15",        fg: "text-amber-500", icon: AlertTriangle, label: "medium" },
  high:    { bg: "bg-danger-500/15",       fg: "text-danger-500", icon: ShieldAlert, label: "high" },
  critical:{ bg: "bg-danger-500/25",       fg: "text-danger-500", icon: AlertOctagon, label: "critical" },
};

export function SeverityChip({ severity }: { severity: ThreatSeverity }) {
  const s = STYLES[severity];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${s.bg} ${s.fg}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

export function ThreatCard({ threat }: { threat: Threat }) {
  const s = STYLES[threat.severity];
  return (
    <div className={`rounded-lg border border-ink-800 p-3 ${threat.severity === "critical" ? "bg-danger-500/5 border-danger-500/30" : "bg-ink-900/60"}`}>
      <div className="flex items-center gap-2 mb-2">
        <SeverityChip severity={threat.severity} />
        <span className="text-[11px] text-ink-400 uppercase tracking-wider">{threat.category.replace(/_/g, " ")}</span>
        <span className="text-[10px] text-ink-600 ml-auto">{threat.source}</span>
      </div>
      <p className="text-sm text-ink-100 mb-1.5 leading-snug">{threat.reason}</p>
      <pre className="text-[11px] text-ink-400 font-mono whitespace-pre-wrap break-words bg-ink-950 p-2 rounded border border-ink-800 max-h-24 overflow-auto scrollbar-thin">{threat.snippet}</pre>
    </div>
  );
}
