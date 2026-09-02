/**
 * SiteConditionsCard — the audit-wide checklist (work zone, felling site,
 * emergency preparedness, housekeeping).
 *
 * These `subject_scope = 'site'` items were seeded from day one but had no home
 * in the UI, so every audit silently skipped them. They bind to the audit itself:
 * rows on `field_audit_items` with a NULL `field_audit_subject_id`. Site findings
 * escalate like any other Fail; the RPC assigns them to the crew foreman.
 *
 * Collapsed by default when nothing has been answered (a person audit shouldn't
 * have to scroll past it), expanded automatically once a site check exists.
 */

import { useMemo, useState } from "react";
import { ChevronDown, TreePine } from "lucide-react";
import SubjectChecklist from "./SubjectChecklist";
import type { SaveItemInput } from "../../../hooks/fieldAudit";
import {
  checklistItemsForSite,
  type AuditChecklistItem,
  type FieldAuditItem,
} from "../fieldAuditConstants";

type DotStatus = "none" | "in_progress" | "pass" | "fail";

const DOT_CLASS: Record<DotStatus, string> = {
  none: "bg-white/20",
  in_progress: "bg-amber-400",
  pass: "bg-emerald-400",
  fail: "bg-rose-400",
};

const DOT_LABEL: Record<DotStatus, string> = {
  none: "Not started",
  in_progress: "In progress",
  pass: "All pass",
  fail: "Has findings",
};

interface SiteConditionsCardProps {
  auditId: string;
  configItems: AuditChecklistItem[];
  /** Items with a NULL subject — already sliced by the tray. */
  siteItems: FieldAuditItem[];
  itemsLoading: boolean;
  saveItem: (input: SaveItemInput) => Promise<FieldAuditItem>;
  removeItem: (id: string) => Promise<void>;
  uploadPhoto: (file: File, auditId: string) => Promise<string>;
  deletePhoto: (path: string) => Promise<void>;
  getSignedUrl: (path: string) => Promise<string | null>;
}

export default function SiteConditionsCard({
  auditId,
  configItems,
  siteItems,
  itemsLoading,
  saveItem,
  removeItem,
  uploadPhoto,
  deletePhoto,
  getSignedUrl,
}: SiteConditionsCardProps) {
  // Until the auditor toggles, follow the data: open once any site check exists
  // (covers resume, where items arrive after first render).
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? siteItems.length > 0;

  const seededCount = useMemo(
    () => checklistItemsForSite(configItems).length,
    [configItems],
  );

  const status: DotStatus = useMemo(() => {
    if (siteItems.some((i) => i.result === "fail")) return "fail";
    if (siteItems.length === 0) return "none";
    const adHocCount = siteItems.filter((i) => i.custom_label != null).length;
    return siteItems.length < seededCount + adHocCount ? "in_progress" : "pass";
  }, [siteItems, seededCount]);

  const answered = siteItems.length;
  const total = seededCount + siteItems.filter((i) => i.custom_label != null).length;

  return (
    <div
      className="rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-950/20 to-[#121A15] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
      data-testid="field-audit-site-card"
    >
      <div className="flex items-center gap-3 p-3.5">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASS[status]}`}
          title={DOT_LABEL[status]}
          aria-label={DOT_LABEL[status]}
        />
        <button
          type="button"
          onClick={() => setUserExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 rounded-lg"
          aria-expanded={expanded}
          data-testid="field-audit-site-toggle"
        >
          <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
            <TreePine className="w-4 h-4 text-rose-200/80" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white truncate">
              Site conditions
            </span>
            <span className="block text-[11px] text-white/45 truncate">
              Work zone · felling site · emergency prep · housekeeping
            </span>
          </span>
          <span className="text-[11px] font-mono tabular-nums text-white/35 shrink-0">
            {answered}/{total}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5">
          <SubjectChecklist
            auditId={auditId}
            scope={{ kind: "site" }}
            configItems={configItems}
            subjectItems={siteItems}
            itemsLoading={itemsLoading}
            saveItem={saveItem}
            removeItem={removeItem}
            uploadPhoto={uploadPhoto}
            deletePhoto={deletePhoto}
            getSignedUrl={getSignedUrl}
          />
        </div>
      )}
    </div>
  );
}
