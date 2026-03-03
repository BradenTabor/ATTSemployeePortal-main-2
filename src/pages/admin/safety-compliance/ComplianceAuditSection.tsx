/**
 * Compliance Audit section for Safety & Compliance Hub.
 * Uses URL-synced auditTab (?auditTab=) and underline-style sub-tabs (distinct from hub's top-level sections).
 */

import { useSearchParams } from "react-router-dom";
import { Database, BookOpen, FileText, Calendar, Package } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  ComplianceAuditContent,
  type ComplianceAuditTabId,
} from "../AdminComplianceAudit";

const AUDIT_TABS: { id: ComplianceAuditTabId; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: "audit", label: "Audit Log", shortLabel: "Audit", icon: <Database className="w-3.5 h-3.5" /> },
  { id: "mapping", label: "OSHA Mapping", shortLabel: "OSHA", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "reports", label: "Reports", shortLabel: "Reports", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "weekly", label: "Weekly Reports", shortLabel: "Weekly", icon: <Calendar className="w-3.5 h-3.5" /> },
  { id: "export", label: "Data Export", shortLabel: "Export", icon: <Package className="w-3.5 h-3.5" /> },
];

function UnderlineAuditTabs({
  tab,
  setTab,
}: {
  tab: ComplianceAuditTabId;
  setTab: (t: ComplianceAuditTabId) => void;
}) {
  return (
    <div className="border-b border-white/10" role="tablist" aria-label="Compliance audit sections">
      <div className="flex flex-wrap gap-x-1 gap-y-0 -mb-px">
        {AUDIT_TABS.map(({ id, label, shortLabel, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            id={`tab-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
              tab === id
                ? "border-amber-400 text-amber-300 bg-amber-500/5"
                : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ComplianceAuditSection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const auditTab = (searchParams.get("auditTab") as ComplianceAuditTabId) || "audit";
  const validTab: ComplianceAuditTabId = AUDIT_TABS.some((t) => t.id === auditTab) ? auditTab : "audit";

  const setAuditTab = (tab: ComplianceAuditTabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("auditTab", tab);
        return next;
      },
      { replace: true }
    );
  };

  return (
    <ComplianceAuditContent
      tab={validTab}
      setTab={setAuditTab}
      renderTabs={(tab, setTab) => <UnderlineAuditTabs tab={tab} setTab={setTab} />}
    />
  );
}
