import { format } from 'date-fns';
import type { LOTOData } from '../../types/electricalHazard';
import { cn } from '../../lib/utils';

interface LOTOSectionProps {
  value: LOTOData | null;
  onChange: (data: LOTOData | null) => void;
  disabled?: boolean;
}

const INITIAL: LOTOData = {
  procedure_followed: false,
  lockout_device_applied: false,
  tagout_attached: false,
  zero_energy_verified: false,
  authorized_employee: '',
  lockout_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
};

export function LOTOSection({ value, onChange, disabled }: LOTOSectionProps) {
  const data = value ?? INITIAL;

  const handleChange = (updates: Partial<LOTOData>) => {
    onChange({ ...data, ...updates });
  };

  const handleCheck = (key: keyof LOTOData, checked: boolean) => {
    handleChange({ [key]: checked });
  };

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3" role="group" aria-label="LOTO (Lockout/Tagout) section">
      <p className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
        LOTO (29 CFR 1910.147)
      </p>
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.procedure_followed}
            onChange={(e) => handleCheck('procedure_followed', e.target.checked)}
            disabled={disabled}
            className="rounded border-white/20"
          />
          <span className="text-sm text-white">LOTO procedure followed (required)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.lockout_device_applied}
            onChange={(e) => handleCheck('lockout_device_applied', e.target.checked)}
            disabled={disabled}
            className="rounded border-white/20"
          />
          <span className="text-sm text-white">Lockout device applied (required)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.tagout_attached}
            onChange={(e) => handleCheck('tagout_attached', e.target.checked)}
            disabled={disabled}
            className="rounded border-white/20"
          />
          <span className="text-sm text-white">Tagout attached (required)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.zero_energy_verified}
            onChange={(e) => handleCheck('zero_energy_verified', e.target.checked)}
            disabled={disabled}
            className="rounded border-white/20"
          />
          <span className="text-sm text-white">Energy source verified at zero-energy state (required)</span>
        </label>
      </div>
      <div>
        <label className="block text-xs text-white/70 mb-1">Authorized employee performing lockout</label>
        <input
          type="text"
          value={data.authorized_employee}
          onChange={(e) => handleChange({ authorized_employee: e.target.value })}
          disabled={disabled}
          placeholder="Name"
          className={cn(
            "w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          )}
        />
      </div>
      <div>
        <label className="block text-xs text-white/70 mb-1">Date/time of lockout</label>
        <input
          type="datetime-local"
          value={data.lockout_datetime}
          onChange={(e) => handleChange({ lockout_datetime: e.target.value })}
          disabled={disabled}
          className={cn(
            "w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          )}
        />
      </div>
    </div>
  );
}
