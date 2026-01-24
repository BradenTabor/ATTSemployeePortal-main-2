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
    gold: "from-[#f4c979]/20 to-[#d79a32]/10 border-[#f4c979]/30 text-[#f4c979]",
    amber: "from-[#fbbf24]/20 to-[#d97706]/10 border-[#fbbf24]/30 text-[#fbbf24]",
    emerald: "from-[#34d399]/20 to-[#059669]/10 border-[#34d399]/30 text-[#34d399]",
    blue: "from-[#60a5fa]/20 to-[#2563eb]/10 border-[#60a5fa]/30 text-[#60a5fa]",
    purple: "from-[#a78bfa]/20 to-[#7c3aed]/10 border-[#a78bfa]/30 text-[#a78bfa]",
  };

  return (
    <div
      className={`rounded-xl sm:rounded-2xl border bg-gradient-to-br ${colorClasses[color]} p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3`}
    >
      <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/20 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5">{icon}</div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold text-white truncate">{value.toLocaleString()}</p>
        <p className="text-[9px] sm:text-xs text-[#c7b696] truncate">{label}</p>
      </div>
    </div>
  );
}

// =============================================================================
// DETAIL ROW
// =============================================================================

export function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-[#c7b696] py-1">
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
    <div className={`rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#d3c2a1]">
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
      <p className="text-[0.65rem] uppercase tracking-wide text-[#d3c2a1]">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-[#c7b696]">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-[#fef3d1] bg-[#2b251b]/80 border border-[#f6dcb2]/30"
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
      className={`rounded-xl sm:rounded-2xl border ${
        isSelected ? "border-[#f4c979] bg-[#f4c979]/5 border-l-2 border-l-[#f4c979]" : "border-[#f6dcb2]/20"
      } bg-[#120f0c]/70 p-3 sm:p-4 space-y-2.5 sm:space-y-3 shadow-lg shadow-black/30 cursor-pointer transition-all active:scale-[0.98] active:bg-[#f4c979]/5`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#f4c979]/80 mb-0.5 sm:mb-1">{formatDate(record.job_date)}</p>
          <p className="text-sm sm:text-base font-semibold text-white truncate">{record.work_location || "Untitled location"}</p>
          <p className="text-[10px] sm:text-xs text-[#c7b696] truncate">{record.circuit_number || "Circuit pending"}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[0.65rem] font-semibold flex-shrink-0 ${
            STATUS_BADGE[record.status || "draft"] || STATUS_BADGE.draft
          }`}
        >
          {record.status === "completed" ? <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <FileEdit className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
          <span className="hidden xs:inline">{record.status || "draft"}</span>
        </span>
      </div>

      <div className="text-[10px] sm:text-xs text-[#c7b696] space-y-1 sm:space-y-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979] flex-shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white/90 truncate">{record.user_name || "Unknown User"}</span>
            {(!record.user_name || record.user_name === "Unknown User") && record.user_id && (
              <Info
                className="w-3 h-3 text-[#c7b696] flex-shrink-0 cursor-help"
                aria-label={`User ID: ${record.user_id}`}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#9cf6d2] flex-shrink-0" />
          <span className="text-white/80 truncate">Signer: {record.employee_signature?.trim() || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#9cf6d2] flex-shrink-0" />
          <span className="truncate">{formatDateTime(record.updated_at || record.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1.5 sm:pt-2">
        <span className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-[#f4c979]">
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
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#f6dcb2]/20">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#f4c979]/80 mb-0.5 sm:mb-1">
            {formatDate(record.job_date)}
          </p>
          <h3 className="text-base sm:text-lg font-bold text-white truncate">{record.work_location || "Location Pending"}</h3>
          <p className="text-[10px] sm:text-xs text-[#c7b696]">Circuit: {record.circuit_number || "—"}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg bg-[#120f0c]/70 border border-[#f4c979]/30 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 transition-colors min-h-[32px] sm:min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-[#120f0c]/70 border border-[#f4c979]/30 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 transition-colors min-h-[32px] sm:min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center"
            aria-label="Close detail panel"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 ${isFullscreen ? "grid md:grid-cols-2 gap-4" : ""}`}>
        <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#f0e2c7]">
            <div className="flex items-center justify-between text-xs text-[#c7b696] py-1">
              <span className="uppercase tracking-wide">Owner</span>
              <div className="flex items-center gap-1.5 text-white font-semibold text-right max-w-[60%]">
                <span className="truncate">{ownerName}</span>
                {isUnknownUser && record.user_id && (
                  <Info
                    className="w-3 h-3 text-[#c7b696] flex-shrink-0 cursor-help"
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
            <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
            <DetailRow label="Driver Signature" value={record.employee_signature?.trim() || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Observers" icon={<Users className="w-4 h-4" />}>
          {observers.length === 0 ? (
            <p className="text-xs text-[#c7b696]">No observers for this JSA.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {observers.map((obs, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-[#120f0c]/50 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-white truncate">{obs.name}</span>
                    <span className="text-[10px] text-[#c7b696] shrink-0">
                      {obs.timestamp ? new Date(obs.timestamp).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  {obs.role && <p className="text-[#c7b696]">{obs.role}</p>}
                  {obs.signature_data && (
                    <p
                      className="text-base text-[#f0e2c7] break-words pt-1"
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
            <p className="text-xs text-[#c7b696]">Not shared with any users.</p>
          ) : (
            <div className="space-y-2">
              {sharedUsers.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-[#120f0c]/50 p-2.5 space-y-1 text-xs text-[#f0e2c7]"
                >
                  <div className="font-semibold text-white truncate">{u.full_name || "Unknown"}</div>
                  <div className="text-[#c7b696] truncate">{u.email || "—"}</div>
                  {u.role ? <div className="text-[#c7b696]">{u.role}</div> : null}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#f0e2c7]">
            <DetailRow label="Nearest Hospital" value={record.nearest_hospital || "—"} />
            <DetailRow label="Nearest Clinic" value={record.nearest_clinic || "—"} />
            <DetailRow label="OC Contact" value={record.oc_contact || "—"} />
            <DetailRow label="DOC Contact" value={record.doc_contact || "—"} />
            <DetailRow label="GF Contact" value={record.gf_contact || "—"} />
            <DetailRow label="Safety Contact" value={record.safety_contact || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Jobs & Weather" icon={<Thermometer className="w-4 h-4" />}>
          <ChipSection title="Jobs Performed" chips={jobs.map((job) => job.label ?? job.key)} emptyText="No jobs selected." />
          <ChipSection title="Conditions" chips={weatherConditions} />
          <ChipSection title="Surface" chips={weatherModifiers} />
          <p className="text-xs text-[#f0e2c7] pt-2">
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
            <p className="text-xs text-[#c7b696]">No spans documented.</p>
          ) : (
            <div className={`grid gap-3 ${isFullscreen ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {spanEntries.map((span) => (
                <div
                  key={span.spanNumber}
                  className="rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-3 text-xs text-[#fdf4db]/85 space-y-1"
                >
                  <div className="flex items-center justify-between text-[#f0e2c7]">
                    <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                    <span className="text-[#c7b696]">{span.location || "No location"}</span>
                  </div>
                  <p>
                    <span className="text-[#c7b696] uppercase tracking-wide">Hazards:</span> {span.hazards?.trim() || "None"}
                  </p>
                  <p>
                    <span className="text-[#c7b696] uppercase tracking-wide">Mitigation:</span>{" "}
                    {span.mitigation?.trim() || "None"}
                  </p>
                  {span.initials && (
                    <p className="text-[#c7b696]">
                      Initials: <span className="text-white">{span.initials}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          <p className="text-xs text-[#f0e2c7]">
            <span className="font-semibold text-white">Signature:</span> {record.employee_signature || "Not captured"}
          </p>
          <p className="text-xs text-[#c7b696] mt-2">
            <span className="font-semibold text-white">Notes:</span>{" "}
            {record.notes?.trim() || "No notes provided for this JSA."}
          </p>
        </DetailCard>
      </div>
    </div>
  );
}
