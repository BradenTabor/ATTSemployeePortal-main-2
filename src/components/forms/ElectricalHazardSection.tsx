import { useMemo } from 'react';
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { lookupMAD, COMMON_VOLTAGES } from '../../data/madReferenceTable';
import { useCrewQualifications } from '../../hooks/queries/useWorkerQualifications';
import { LOTOSection } from './LOTOSection';
import type { ElectricalHazardData } from '../../types/electricalHazard';
import { cn } from '../../lib/utils';

export interface CrewMember {
  id: string;
  name: string;
}

interface ElectricalHazardSectionProps {
  value: ElectricalHazardData | null;
  onChange: (data: ElectricalHazardData | null) => void;
  crewMembers: CrewMember[];
  disabled?: boolean;
}

const INITIAL: ElectricalHazardData = {
  voltage_kv: 0,
  voltage_label: '',
  mad_phase_to_ground: '',
  mad_phase_to_phase: '',
  utility_company_contacted: false,
  utility_company_name: '',
  utility_contact_name: '',
  utility_confirmation_time: '',
  crew_qualifications_verified: false,
  crew_qualification_issues: [],
  second_worker_required: false,
  second_worker_name: '',
  loto_required: false,
  loto_procedure_followed: false,
  loto_authorized_employee: '',
};

export function ElectricalHazardSection({
  value,
  onChange,
  crewMembers,
  disabled = false,
}: ElectricalHazardSectionProps) {
  const data = value ?? { ...INITIAL };
  const crewMemberIds = crewMembers.map((c) => c.id);
  const crewQuals = useCrewQualifications(crewMemberIds);

  const mad = useMemo(() => lookupMAD(data.voltage_kv > 0 ? data.voltage_kv : -1), [data.voltage_kv]);
  const secondWorkerRequired = data.voltage_kv > 0.75;
  const unqualifiedNames = useMemo(() => {
    if (!crewQuals.data) return [];
    return crewMembers
      .filter((c) => (crewQuals.data?.[c.id] ?? 'unqualified') === 'unqualified')
      .map((c) => c.name);
  }, [crewQuals.data, crewMembers]);
  const hasUnqualified = unqualifiedNames.length > 0;

  const handleChange = (updates: Partial<ElectricalHazardData>) => {
    const next = { ...data, ...updates };
    if (updates.voltage_kv !== undefined) {
      const entry = COMMON_VOLTAGES.find((v) => v.kv === updates.voltage_kv);
      next.voltage_label = entry?.label ?? '';
      const m = lookupMAD(updates.voltage_kv > 0 ? updates.voltage_kv : -1);
      next.mad_phase_to_ground = m?.phaseToGround ?? '';
      next.mad_phase_to_phase = m?.phaseToPhase ?? '';
      next.second_worker_required = updates.voltage_kv > 0.75;
    }
    onChange(next);
  };

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4" role="region" aria-label="Electrical hazard details (OSHA 1910.269)">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-semibold text-amber-200">Electrical Hazard Details</p>
      </div>

      <div>
        <label className="block text-xs text-white/70 mb-1">Voltage</label>
        <select
          value={data.voltage_kv < 0 ? -1 : data.voltage_kv}
          onChange={(e) => {
            const kv = parseFloat(e.target.value);
            handleChange({ voltage_kv: kv >= 0 ? kv : 0 });
          }}
          disabled={disabled}
          className={cn(
            "w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          )}
        >
          {COMMON_VOLTAGES.map((v) => (
            <option key={v.label} value={v.kv}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {mad && data.voltage_kv > 0 && (
        <div className="rounded bg-white/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-200">Minimum Approach Distance (MAD)</p>
          <p className="text-sm text-white">Phase-to-ground: {mad.phaseToGround}</p>
          <p className="text-sm text-white">Phase-to-phase: {mad.phaseToPhase}</p>
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.utility_company_contacted}
          onChange={(e) => handleChange({ utility_company_contacted: e.target.checked })}
          disabled={disabled}
          className="rounded border-white/20"
        />
        <span className="text-sm text-white">Utility company contacted</span>
      </label>

      {data.utility_company_contacted && (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Company name"
            value={data.utility_company_name}
            onChange={(e) => handleChange({ utility_company_name: e.target.value })}
            disabled={disabled}
            className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="Contact name"
            value={data.utility_contact_name}
            onChange={(e) => handleChange({ utility_contact_name: e.target.value })}
            disabled={disabled}
            className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <input
            type="text"
            placeholder="Confirmation time"
            value={data.utility_confirmation_time}
            onChange={(e) => handleChange({ utility_confirmation_time: e.target.value })}
            disabled={disabled}
            className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
        </div>
      )}

      {crewMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/80">Crew qualification verification</p>
          {crewQuals.isLoading ? (
            <p className="text-xs text-white/60">Checking qualifications…</p>
          ) : (
            <ul className="space-y-1">
              {crewMembers.map((c) => {
                const level = crewQuals.data?.[c.id] ?? 'unqualified';
                return (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    {level === 'unqualified' ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-red-300">{c.name} — unqualified for energized line work (OSHA 1910.269)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-white/80">{c.name}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hasUnqualified && (
            <p className="text-xs text-red-300 font-medium" role="alert">
              Form cannot be submitted with unqualified crew members on energized work.
            </p>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.crew_qualifications_verified}
              onChange={(e) =>
                handleChange({
                  crew_qualifications_verified: e.target.checked,
                  crew_qualification_issues: e.target.checked ? [] : unqualifiedNames,
                })
              }
              disabled={disabled || hasUnqualified}
              className="rounded border-white/20"
            />
            <span className="text-sm text-white">Crew qualifications verified (all qualified)</span>
          </label>
        </div>
      )}

      {secondWorkerRequired && (
        <div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={true}
              readOnly
              className="rounded border-white/20"
            />
            <span className="text-sm text-white">A second qualified employee is within voice range (required &gt;750V)</span>
          </label>
          <input
            type="text"
            placeholder="Second worker name"
            value={data.second_worker_name}
            onChange={(e) => handleChange({ second_worker_name: e.target.value })}
            disabled={disabled}
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.loto_required}
          onChange={(e) => handleChange({ loto_required: e.target.checked })}
          disabled={disabled}
          className="rounded border-white/20"
        />
        <span className="text-sm text-white">Work involves de-energization requiring LOTO</span>
      </label>

      {data.loto_required && (
        <LOTOSection
          value={data.loto_data ?? {
            procedure_followed: data.loto_procedure_followed,
            lockout_device_applied: false,
            tagout_attached: false,
            zero_energy_verified: false,
            authorized_employee: data.loto_authorized_employee,
            lockout_datetime: new Date().toISOString().slice(0, 16),
          }}
          onChange={(loto) => {
            if (loto)
              handleChange({
                loto_procedure_followed: loto.procedure_followed,
                loto_authorized_employee: loto.authorized_employee,
                loto_data: loto,
              });
          }}
          disabled={disabled}
        />
      )}
    </div>
  );
}
