/**
 * Extracted UI components for AdminJSA page
 */

import React from "react";
import {
  User,
  Users,
  UserPlus,
  Clock,
  ChevronRight,
  Shield,
  Thermometer,
  Wind,
  AlertTriangle,
  AlignLeft,
  X,
  Maximize2,
  Minimize2,
  CheckCircle2,
  FileEdit,
  Info,
} from "lucide-react";
import type { JsaSpan, ObserverSignature, SharedUser } from "../../forms/DailyJSAForm";
import type { AdminJsaRow, JobSelection, WeatherPayload } from "./types";
import {
  WEATHER_CONDITIONS,
  WEATHER_MODIFIERS,
  HAZARD_ITEMS,
  TRAFFIC_HAZARDS,
  TRAFFIC_SETUP,
  STATUS_BADGE,
} from "./constants";
import { formatDate, formatDateTime, getActiveLabels } from "./helpers";

// =============================================================================
// STAT CARD
// =============================================================================

export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "gold" | "amber" | "emerald" | "blue" | "purple";
}) {
  const colorClasses = {
    gold: "from-[#F4F7F2]/20 to-[#8DF5A8]/10 border-[#F4F7F2]/30 text-[#F4F7F2]",
    amber: "from-[#B8FF7A]/20 to-[#7CC43F]/10 border-[#B8FF7A]/30 text-[#B8FF7A]",
    emerald: "from-[#5EE898]/20 to-[#2FA45A]/10 border-[#5EE898]/30 text-[#5EE898]",
    blue: "from-[#C8FFD4]/20 to-[#5EE898]/10 border-[#C8FFD4]/30 text-[#C8FFD4]",
    purple: "from-[#3DDC84]/20 to-[#1F7A44]/10 border-[#3DDC84]/30 text-[#3DDC84]",
  };

  return (
    <div
      className={`rounded-xl sm:rounded-leaf-sm border bg-gradient-to-br ${colorClasses[color]} p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3`}
    >
      <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/20 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5">{icon}</div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold text-white font-mono tabular-nums truncate">{value.toLocaleString()}</p>
        <p className="text-[9px] sm:text-xs text-[#B8C4B6] truncate">{label}</p>
      </div>
    </div>
  );
}

// =============================================================================
// DETAIL ROW
// =============================================================================

export function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-[#B8C4B6] py-1">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold text-right max-w-[60%] truncate">{value || "—"}</span>
    </div>
  );
}

// =============================================================================
// DETAIL CARD
// =============================================================================

export function DetailCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-leaf-sm border border-[#E4EAE1]/20 bg-[#0B100D]/70 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-[#DDFF85] font-mono font-medium tracking-[0.14em]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

// =============================================================================
// CHIP SECTION
// =============================================================================

export function ChipSection({
  title,
  chips,
  emptyText = "No data provided.",
}: {
  title: string;
  chips: string[];
  emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] uppercase text-[#DDFF85] font-mono font-medium tracking-[0.14em]">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-[#B8C4B6]">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-[#F4F7F2] bg-[#1E2A23]/80 border border-[#E4EAE1]/30"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MOBILE JSA CARD
// =============================================================================

export function MobileJsaCard({
  record,
  onSelect,
  isSelected,
}: {
  record: AdminJsaRow;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl sm:rounded-leaf-sm border ${
        isSelected ? "border-[#F4F7F2] bg-[#F4F7F2]/5 border-l-2 border-l-[#F4F7F2]" : "border-[#E4EAE1]/20"
      } bg-[#0B100D]/70 p-3 sm:p-4 space-y-2.5 sm:space-y-3 shadow-lg shadow-black/30 cursor-pointer transition-all active:scale-[0.98] active:bg-[#F4F7F2]/5`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-xs uppercase sm:tracking-[0.3em] text-[#F4F7F2]/80 mb-0.5 sm:mb-1 font-mono font-medium tracking-[0.14em]">{formatDate(record.job_date)}</p>
          <p className="text-sm sm:text-base font-semibold text-white truncate">{record.work_location || "Untitled location"}</p>
          <p className="text-[10px] sm:text-xs text-[#B8C4B6] truncate">{record.circuit_number || "Circuit pending"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[0.65rem] font-semibold ${
              STATUS_BADGE[record.status || "draft"] || STATUS_BADGE.draft
            }`}
          >
            {record.status === "completed" ? <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <FileEdit className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            <span className="hidden xs:inline">{record.status || "draft"}</span>
          </span>
          {record.submission_type === "paper" && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Paper
            </span>
          )}
        </div>
      </div>

      <div className="text-[10px] sm:text-xs text-[#B8C4B6] space-y-1 sm:space-y-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F4F7F2] flex-shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white/90 truncate">{record.user_name || "Unknown User"}</span>
            {(!record.user_name || record.user_name === "Unknown User") && record.user_id && (
              <Info
                className="w-3 h-3 text-[#B8C4B6] flex-shrink-0 cursor-help"
                aria-label={`User ID: ${record.user_id}`}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8DF5A8] flex-shrink-0" />
          <span className="text-white/80 truncate">Signer: {record.employee_signature?.trim() || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8DF5A8] flex-shrink-0" />
          <span className="truncate">{formatDateTime(record.updated_at || record.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1.5 sm:pt-2">
        <span className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-[#F4F7F2]">
          {isSelected ? "Selected" : "View"}
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// SELECTED JSA DETAIL PANEL
// =============================================================================

export function SelectedJsaDetail({
  record,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: {
  record: AdminJsaRow;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const ownerName = record.user_name || "Unknown User";
  const ownerEmail = record.user_email || "Not available";
  const ownerRole = record.user_role || "—";
  const isUnknownUser = ownerName === "Unknown User";

  // Parse job selections
  const jobsPerformed = (record.jobs_performed || []) as JobSelection[];
  const jobs = jobsPerformed.length > 0 ? jobsPerformed : [];

  // Parse weather
  const weatherData = (record.weather_conditions || {}) as WeatherPayload;
  const weatherConditions = getActiveLabels(weatherData.conditions, WEATHER_CONDITIONS);
  const weatherModifiers = getActiveLabels(weatherData.modifiers, WEATHER_MODIFIERS);

  // Parse hazards
  const hazardsPresent = (record.hazards_present || {}) as Record<string, boolean>;
  const hazardLabels = getActiveLabels(hazardsPresent, HAZARD_ITEMS);

  // Parse traffic
  const trafficHazardsData = (record.traffic_hazards || {}) as Record<string, boolean>;
  const trafficSetupData = (record.traffic_setup || {}) as Record<string, boolean>;
  const trafficHazards = getActiveLabels(trafficHazardsData, TRAFFIC_HAZARDS);
  const trafficSetup = getActiveLabels(trafficSetupData, TRAFFIC_SETUP);

  // Parse spans
  const spanEntries = (record.spans || []) as JsaSpan[];

  // Parse observers and shared users
  const observers = (Array.isArray(record.observer_signatures) ? record.observer_signatures : []) as ObserverSignature[];
  const sharedUsers = (Array.isArray(record.shared_with_users) ? record.shared_with_users : []) as SharedUser[];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#E4EAE1]/20">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-xs uppercase sm:tracking-[0.3em] text-[#F4F7F2]/80 mb-0.5 sm:mb-1 font-mono font-medium tracking-[0.14em]">
            {formatDate(record.job_date)}
          </p>
          <h3 className="text-base sm:text-lg font-bold text-white truncate">{record.work_location || "Location Pending"}</h3>
          <p className="text-[10px] sm:text-xs text-[#B8C4B6]">Circuit: {record.circuit_number || "—"}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="tap-44 relative p-1.5 sm:p-2 rounded-lg bg-[#0B100D]/70 border border-[#F4F7F2]/30 text-[#F4F7F2] hover:bg-[#F4F7F2]/10 active:bg-[#F4F7F2]/20 transition-colors min-h-[32px] sm:min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tap-44 relative p-1.5 sm:p-2 rounded-lg bg-[#0B100D]/70 border border-[#F4F7F2]/30 text-[#F4F7F2] hover:bg-[#F4F7F2]/10 active:bg-[#F4F7F2]/20 transition-colors min-h-[32px] sm:min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center"
            aria-label="Close detail panel"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 ${isFullscreen ? "grid md:grid-cols-2 gap-4" : ""}`}>
        <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#D3DCD1]">
            <div className="flex items-center justify-between text-xs text-[#B8C4B6] py-1">
              <span className="uppercase tracking-wide">Owner</span>
              <div className="flex items-center gap-1.5 text-white font-semibold text-right max-w-[60%]">
                <span className="truncate">{ownerName}</span>
                {isUnknownUser && record.user_id && (
                  <Info
                    className="w-3 h-3 text-[#B8C4B6] flex-shrink-0 cursor-help"
                    aria-label={`User ID: ${record.user_id}`}
                  />
                )}
              </div>
            </div>
            <DetailRow label="Email" value={ownerEmail} />
            <DetailRow label="Role" value={ownerRole} />
            <DetailRow label="Job Date" value={formatDate(record.job_date)} />
            <DetailRow label="Call Times" value={`${record.call_in_time || "—"} → ${record.call_out_time || "—"}`} />
            <DetailRow label="Status" value={record.status} />
            <DetailRow label="Type" value={record.submission_type === "paper" ? "Paper" : "Digital"} />
            <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
            <DetailRow label="Driver Signature" value={record.employee_signature?.trim() || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Observers" icon={<Users className="w-4 h-4" />}>
          {observers.length === 0 ? (
            <p className="text-xs text-[#B8C4B6]">No observers for this JSA.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {observers.map((obs, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#E4EAE1]/15 bg-[#0B100D]/50 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-white truncate">{obs.name}</span>
                    <span className="text-[10px] text-[#B8C4B6] shrink-0">
                      {obs.timestamp ? new Date(obs.timestamp).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  {obs.role && <p className="text-[#B8C4B6]">{obs.role}</p>}
                  {obs.signature_data && (
                    <p
                      className="text-base text-[#D3DCD1] break-words pt-1"
                      style={{ fontFamily: "Caveat, cursive" }}
                    >
                      {obs.signature_data}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Shared with" icon={<UserPlus className="w-4 h-4" />}>
          {sharedUsers.length === 0 ? (
            <p className="text-xs text-[#B8C4B6]">Not shared with any users.</p>
          ) : (
            <div className="space-y-2">
              {sharedUsers.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-[#E4EAE1]/15 bg-[#0B100D]/50 p-2.5 space-y-1 text-xs text-[#D3DCD1]"
                >
                  <div className="font-semibold text-white truncate">{u.full_name || "Unknown"}</div>
                  <div className="text-[#B8C4B6] truncate">{u.email || "—"}</div>
                  {u.role ? <div className="text-[#B8C4B6]">{u.role}</div> : null}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#D3DCD1]">
            <DetailRow label="Nearest Hospital" value={record.nearest_hospital || "—"} />
            <DetailRow label="Nearest Clinic" value={record.nearest_clinic || "—"} />
            <DetailRow label="OC Contact" value={record.oc_contact || "—"} />
            <DetailRow label="DOC Contact" value={record.doc_contact || "—"} />
            <DetailRow label="GF Contact" value={record.gf_contact || "—"} />
            <DetailRow label="Safety Contact" value={record.safety_contact || "—"} />
          </div>
        </DetailCard>

        {record.submission_type !== "paper" && (
        <>
        <DetailCard title="Jobs & Weather" icon={<Thermometer className="w-4 h-4" />}>
          <ChipSection title="Jobs Performed" chips={jobs.map((job) => job.label ?? job.key)} emptyText="No jobs selected." />
          <ChipSection title="Conditions" chips={weatherConditions} />
          <ChipSection title="Surface" chips={weatherModifiers} />
          <p className="text-xs text-[#D3DCD1] pt-2">
            <span className="font-semibold text-white">Weather hazards: </span>
            {record.weather_hazards?.trim() || "None provided."}
          </p>
        </DetailCard>

        <DetailCard title="Hazards & Traffic" icon={<AlertTriangle className="w-4 h-4" />}>
          <ChipSection title="Electrical / Structural" chips={hazardLabels} emptyText="No hazards flagged." />
          <ChipSection title="Traffic Hazards" chips={trafficHazards} emptyText="No traffic hazards flagged." />
          <ChipSection title="Work Zone Setup" chips={trafficSetup} emptyText="No setup details flagged." />
        </DetailCard>

        <DetailCard title="Span Walk-through" icon={<Wind className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          {spanEntries.length === 0 ? (
            <p className="text-xs text-[#B8C4B6]">No spans documented.</p>
          ) : (
            <div className={`grid gap-3 ${isFullscreen ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {spanEntries.map((span) => (
                <div
                  key={span.spanNumber}
                  className="rounded-leaf-sm border border-[#E4EAE1]/20 bg-[#0B100D]/70 p-3 text-xs text-[#F4F7F2]/85 space-y-1"
                >
                  <div className="flex items-center justify-between text-[#D3DCD1]">
                    <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                    <span className="text-[#B8C4B6]">{span.location || "No location"}</span>
                  </div>
                  <p>
                    <span className="text-[#B8C4B6] uppercase tracking-wide">Hazards:</span> {span.hazards?.trim() || "None"}
                  </p>
                  <p>
                    <span className="text-[#B8C4B6] uppercase tracking-wide">Mitigation:</span>{" "}
                    {span.mitigation?.trim() || "None"}
                  </p>
                  {span.initials && (
                    <p className="text-[#B8C4B6]">
                      Initials: <span className="text-white">{span.initials}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>
        </>
        )}

        <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          <p className="text-xs text-[#D3DCD1]">
            <span className="font-semibold text-white">Signature:</span> {record.employee_signature || "Not captured"}
          </p>
          <p className="text-xs text-[#B8C4B6] mt-2">
            <span className="font-semibold text-white">Notes:</span>{" "}
            {record.notes?.trim() || "No notes provided for this JSA."}
          </p>
        </DetailCard>
      </div>
    </div>
  );
}
