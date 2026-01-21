import type { ComponentType } from "react";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";
import { DateField, TimeField } from "../GlassyPickers";
import { LocationInputField } from "../LocationInputField";
import { ContactTemplatePicker } from "../ContactTemplatePicker";
import { SavedLocationPicker } from "../SavedLocationPicker";

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

// Animated checkmark for completed fields
function FieldCheckmark({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </motion.div>
      )}
    </AnimatePresence>
  );
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
  showCheckmark?: boolean;
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
  showCheckmark = true,
}: InputFieldProps) {
  const isFilled = value?.trim().length > 0;
  
  return (
    <div className={className}>
      <label className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-white/70 mb-0.5 sm:mb-1 uppercase tracking-wide">
        <span>
          {label}
          {required && <span className="text-emerald-400 ml-0.5">*</span>}
        </span>
        {/* Mini checkmark next to label when filled */}
        {isFilled && showCheckmark && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-emerald-400"
          >
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </motion.span>
        )}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className={cn(
            "absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 transition-colors",
            isFilled ? "text-emerald-500" : "text-emerald-500/50"
          )} />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full rounded-lg border bg-black/50 px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all",
            Icon ? "pl-8 sm:pl-9" : "",
            isFilled && showCheckmark ? "pr-8 sm:pr-9 border-emerald-500/30" : "border-white/10"
          )}
        />
        {/* Checkmark inside input when filled */}
        {showCheckmark && <FieldCheckmark visible={isFilled} />}
      </div>
    </div>
  );
}

export function StepJobInfo({ form, onInputChange, isLoading }: StepJobInfoProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-amber-200 text-[10px] sm:text-xs p-2 sm:p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
          Loading existing data...
        </div>
      )}

      {/* Schedule */}
      <div className="space-y-2 sm:space-y-3">
        <p className="text-[10px] sm:text-xs font-medium text-white/50 uppercase tracking-wider">
          Schedule
        </p>
        <div className="grid gap-2 sm:gap-3 sm:grid-cols-3">
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
      <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
        <p className="text-[10px] sm:text-xs font-medium text-white/50 uppercase tracking-wider">
          Location
        </p>
        
        {/* Saved Locations Quick-Pick */}
        <SavedLocationPicker
          currentValues={{
            workLocation: form.workLocation,
            nearestHospital: form.nearestHospital,
            nearestClinic: form.nearestClinic,
            circuitNumber: form.circuitNumber,
          }}
          onApply={(values) => {
            onInputChange("workLocation", values.workLocation);
            onInputChange("nearestHospital", values.nearestHospital);
            onInputChange("nearestClinic", values.nearestClinic);
            onInputChange("circuitNumber", values.circuitNumber);
          }}
        />

        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
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
        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
          <LocationInputField
            label="Nearest Hospital"
            value={form.nearestHospital}
            onChange={(value) => onInputChange("nearestHospital", value)}
            locationType="hospital"
            placeholder="Hospital name"
          />
          <LocationInputField
            label="Nearest Clinic"
            value={form.nearestClinic}
            onChange={(value) => onInputChange("nearestClinic", value)}
            locationType="clinic"
            placeholder="Clinic name"
          />
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
        <p className="text-[10px] sm:text-xs font-medium text-white/50 uppercase tracking-wider">
          Emergency Contacts
        </p>
        
        {/* Contact Template Quick-Fill */}
        <ContactTemplatePicker
          currentContacts={{
            oc: form.ocContact,
            doc: form.docContact,
            gf: form.gfContact,
            safety: form.safetyContact,
          }}
          onApply={(contacts) => {
            onInputChange("ocContact", contacts.oc);
            onInputChange("docContact", contacts.doc);
            onInputChange("gfContact", contacts.gf);
            onInputChange("safetyContact", contacts.safety);
          }}
        />

        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
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
