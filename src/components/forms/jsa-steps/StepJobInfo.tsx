import type { ComponentType } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { DateField, TimeField } from "../GlassyPickers";

type JobInfoFields = {
  jobDate: string;
  callInTime: string;
  callOutTime: string;
  workLocation: string;
  circuitNumber: string;
  nearestHospital: string;
  nearestClinic: string;
  ocContact: string;
  docContact: string;
  gfContact: string;
  safetyContact: string;
  status: "draft" | "completed";
};

interface StepJobInfoProps {
  form: JobInfoFields;
  onInputChange: (key: keyof JobInfoFields, value: string) => void;
  isLoading?: boolean;
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ComponentType<{ className?: string }>;
  required?: boolean;
  className?: string;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  required,
  className,
}: InputFieldProps) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-white/70 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-emerald-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500/50" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all",
            Icon ? "pl-9" : ""
          )}
        />
      </div>
    </div>
  );
}

export function StepJobInfo({ form, onInputChange, isLoading }: StepJobInfoProps) {
  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-amber-200 text-xs p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading existing data...
        </div>
      )}

      {/* Schedule */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Schedule
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <DateField
            label="Job Date"
            value={form.jobDate || ""}
            onValueChange={(value) => onInputChange("jobDate", value)}
            helperText="Crew on site"
            required
          />
          <TimeField
            label="Call-in"
            value={form.callInTime || ""}
            onValueChange={(value) => onInputChange("callInTime", value)}
            helperText="AM briefing"
          />
          <TimeField
            label="Call-out"
            value={form.callOutTime || ""}
            onValueChange={(value) => onInputChange("callOutTime", value)}
            helperText="Est. completion"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Location
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            label="Work Location"
            icon={MapPin}
            value={form.workLocation}
            onChange={(value) => onInputChange("workLocation", value)}
            placeholder="Street, city, project"
            required
          />
          <InputField
            label="Circuit #"
            value={form.circuitNumber}
            onChange={(value) => onInputChange("circuitNumber", value)}
            placeholder="Circuit number"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            label="Nearest Hospital"
            value={form.nearestHospital}
            onChange={(value) => onInputChange("nearestHospital", value)}
            placeholder="Hospital name"
          />
          <InputField
            label="Nearest Clinic"
            value={form.nearestClinic}
            onChange={(value) => onInputChange("nearestClinic", value)}
            placeholder="Clinic name"
          />
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Emergency Contacts
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            label="OC Contact"
            type="tel"
            required
            value={form.ocContact}
            onChange={(value) => onInputChange("ocContact", value)}
            placeholder="Name · 870-555-1234"
          />
          <InputField
            label="DOC Tel"
            type="tel"
            required
            value={form.docContact}
            onChange={(value) => onInputChange("docContact", value)}
            placeholder="870-555-5678"
          />
          <InputField
            label="GF Contact"
            type="tel"
            required
            value={form.gfContact}
            onChange={(value) => onInputChange("gfContact", value)}
            placeholder="Name · 870-555-2468"
          />
          <InputField
            label="Safety Tel"
            type="tel"
            required
            value={form.safetyContact}
            onChange={(value) => onInputChange("safetyContact", value)}
            placeholder="870-555-1357"
          />
        </div>
      </div>
    </div>
  );
}
