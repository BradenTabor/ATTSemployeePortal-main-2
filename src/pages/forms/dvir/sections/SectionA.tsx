/**
 * DVIR Form Section A: Vehicle / Driver Information
 * 
 * Extracted from DVIRForm.tsx to reduce component size and improve maintainability.
 */

import { DateField } from "../../../../components/forms/GlassyPickers";
import { SectionCard } from "../components";
import { MileageInput } from "../components";
import { cn } from "../../../../lib/utils";
import { AlertTriangle, Truck } from "lucide-react";
import { motion } from "framer-motion";
import type { DVIRFormState } from "../types";
import { TRUCK_NUMBERS, CHIPPER_NUMBERS, TRAILER_NUMBERS } from "../types";

interface SectionAProps {
  form: DVIRFormState;
  setForm: React.Dispatch<React.SetStateAction<DVIRFormState>>;
  previousMileage: number | null;
  getFieldError: (field: keyof DVIRFormState) => string | null;
  shouldShowError: (field: keyof DVIRFormState) => boolean;
  handleFieldBlur: (field: keyof DVIRFormState) => void;
}

export function SectionA({
  form,
  setForm,
  previousMileage,
  getFieldError,
  shouldShowError,
  handleFieldBlur,
}: SectionAProps) {
  return (
    <SectionCard
      title="Section A. Vehicle / Driver Information"
      subtitle="Complete before operating any ATTS vehicle. Fields marked with * are required."
      badge="Required"
    >
      {/* Truck Selection - Full Width for prominence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* TRUCK NUMBER as dropdown - Enhanced */}
        <div className="sm:col-span-1">
          <label htmlFor="truckNumber" className="flex items-center gap-2 text-xs text-gray-300 mb-1">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            SELECT TRUCK *
          </label>
          <select
            id="truckNumber"
            name="truckNumber"
            data-testid="truck-number-select"
            value={form.truckNumber}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, truckNumber: e.target.value }));
              handleFieldBlur('truckNumber' as keyof DVIRFormState);
            }}
            onBlur={() => handleFieldBlur('truckNumber' as keyof DVIRFormState)}
            className={cn(
              "w-full rounded-xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900",
              "border px-4 py-3 text-base text-white font-medium",
              "focus:outline-none focus:ring-2 transition-all",
              shouldShowError('truckNumber' as keyof DVIRFormState) && getFieldError('truckNumber' as keyof DVIRFormState)
                ? "border-rose-500/50 focus:ring-rose-400/50"
                : form.truckNumber 
                  ? "border-emerald-500/40 focus:ring-emerald-400/50"
                  : "border-gray-700 focus:ring-emerald-400/50"
            )}
            title="Select truck number"
            aria-required="true"
            aria-invalid={shouldShowError('truckNumber' as keyof DVIRFormState) && !!getFieldError('truckNumber' as keyof DVIRFormState)}
            aria-describedby={shouldShowError('truckNumber' as keyof DVIRFormState) && getFieldError('truckNumber' as keyof DVIRFormState) ? "truckNumber-error" : undefined}
          >
            <option value="">Select Truck Number</option>
            {TRUCK_NUMBERS.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
          {shouldShowError('truckNumber' as keyof DVIRFormState) && getFieldError('truckNumber' as keyof DVIRFormState) && (
            <motion.p 
              id="truckNumber-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-rose-400 mt-1 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              {getFieldError('truckNumber' as keyof DVIRFormState)}
            </motion.p>
          )}
          {form.truckNumber && !shouldShowError('truckNumber' as keyof DVIRFormState) && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-emerald-400/70 mt-1"
            >
              ✓ Truck {form.truckNumber} selected
            </motion.p>
          )}
        </div>

        {/* Enhanced Mileage Input */}
        <div className="sm:col-span-1">
          <MileageInput
            value={form.mileage}
            onChange={(val) => setForm((prev) => ({ ...prev, mileage: val }))}
            truckNumber={form.truckNumber}
            previousMileage={previousMileage}
          />
        </div>
      </div>
      
      {/* Equipment Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CHIPPER NUMBER as dropdown */}
        <div>
          <label htmlFor="chipperNumber" className="block text-xs text-gray-300 mb-1">
            CHIPPER NUMBER
          </label>
          <select
            id="chipperNumber"
            value={form.chipperNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, chipperNumber: e.target.value }))}
            className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
            title="Select chipper number"
          >
            <option value="">Select Chipper Number</option>
            {CHIPPER_NUMBERS.map((chip) => (
              <option key={chip} value={chip}>
                {chip}
              </option>
            ))}
          </select>
        </div>

        {/* TRAILER NUMBER as dropdown */}
        <div>
          <label htmlFor="trailerNumber" className="block text-xs text-gray-300 mb-1">
            TRAILER NUMBER
          </label>
          <select
            id="trailerNumber"
            value={form.trailerNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, trailerNumber: e.target.value }))}
            className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
            title="Select trailer number"
          >
            <option value="">Select Trailer Number</option>
            {TRAILER_NUMBERS.map((trail) => (
              <option key={trail} value={trail}>
                {trail}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="truckGvwr" className="block text-xs text-gray-300 mb-1">
            TRUCK GVWR
          </label>
          <input
            id="truckGvwr"
            value={form.truckGvwr}
            onChange={(e) => setForm((prev) => ({ ...prev, truckGvwr: e.target.value }))}
            placeholder="e.g., 26,000 lbs"
            className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
          />
        </div>

        <div>
          <label htmlFor="trailerChipperGvwr" className="block text-xs text-gray-300 mb-1">
            TRAILER / CHIPPER GVWR
          </label>
          <input
            id="trailerChipperGvwr"
            value={form.trailerChipperGvwr}
            onChange={(e) => setForm((prev) => ({ ...prev, trailerChipperGvwr: e.target.value }))}
            placeholder="e.g., 14,000 lbs"
            className="w-full rounded-xl bg-black/70 border border-gray-700 px-3 py-2.5 text-base text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
          />
        </div>
      </div>

      {/* Medical card required - 44px touch targets for mobile */}
      <div>
        <label className="block text-xs text-gray-300 mb-1">
          IS A MEDICAL CARD REQUIRED
        </label>
        <div className="flex gap-2 text-xs text-gray-200">
          <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
            <input
              type="radio"
              name="medical_card_required"
              value="YES"
              checked={form.medicalCardRequired === "YES"}
              onChange={() => setForm((prev) => ({ ...prev, medicalCardRequired: "YES" }))}
              className="w-4 h-4 accent-emerald-500"
            />
            YES
          </label>
          <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
            <input
              type="radio"
              name="medical_card_required"
              value="NO"
              checked={form.medicalCardRequired === "NO"}
              onChange={() => setForm((prev) => ({ ...prev, medicalCardRequired: "NO" }))}
              className="w-4 h-4 accent-emerald-500"
            />
            NO
          </label>
        </div>
      </div>

      {/* Driver + License fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="driversName" className="block text-xs text-gray-300 mb-1">
            DRIVERS NAME *
          </label>
          <input
            id="driversName"
            name="driversName"
            data-testid="drivers-name-input"
            value={form.driversName}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, driversName: e.target.value }));
              handleFieldBlur('driversName' as keyof DVIRFormState);
            }}
            onBlur={() => handleFieldBlur('driversName' as keyof DVIRFormState)}
            placeholder="Enter full name"
            className={cn(
              "w-full rounded-md bg-black/70 border px-3 py-2 text-base text-white",
              "focus:outline-none focus:ring-2 transition-all",
              shouldShowError('driversName' as keyof DVIRFormState) && getFieldError('driversName' as keyof DVIRFormState)
                ? "border-rose-500/50 focus:ring-rose-400/50"
                : "border-gray-700 focus:ring-emerald-400/50"
            )}
            aria-required="true"
            aria-invalid={shouldShowError('driversName' as keyof DVIRFormState) && !!getFieldError('driversName' as keyof DVIRFormState)}
            aria-describedby={shouldShowError('driversName' as keyof DVIRFormState) && getFieldError('driversName' as keyof DVIRFormState) ? "driversName-error" : undefined}
          />
          {shouldShowError('driversName' as keyof DVIRFormState) && getFieldError('driversName' as keyof DVIRFormState) && (
            <motion.p 
              id="driversName-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-rose-400 mt-1 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              {getFieldError('driversName' as keyof DVIRFormState)}
            </motion.p>
          )}
        </div>
      </div>

      {/* Driver License Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="driversLicenseNumber" className="block text-xs text-gray-300 mb-1">
            DRIVERS LICENSE NUMBER
          </label>
          <input
            id="driversLicenseNumber"
            value={form.driversLicenseNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, driversLicenseNumber: e.target.value }))}
            placeholder="Enter license number"
            className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-base text-white"
          />
        </div>

        <div>
          <label htmlFor="driversLicenseClass" className="block text-xs text-gray-300 mb-1">
            DRIVERS LICENSE CLASS
          </label>
          <input
            id="driversLicenseClass"
            value={form.driversLicenseClass}
            onChange={(e) => setForm((prev) => ({ ...prev, driversLicenseClass: e.target.value }))}
            placeholder="e.g., Class A, B, C"
            className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-base text-white"
          />
        </div>

        <div>
          <label htmlFor="driversLicenseExp" className="block text-xs text-gray-300 mb-1">
            DRIVERS LICENSE EXP. (MM/DD/YYYY)
          </label>
          <input
            id="driversLicenseExp"
            value={form.driversLicenseExp}
            onChange={(e) => setForm((prev) => ({ ...prev, driversLicenseExp: e.target.value }))}
            placeholder="MM/DD/YYYY"
            className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-base text-white"
          />
        </div>
      </div>

      {/* License required + medical card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            DRIVERS LICENSE REQUIRED
          </label>
          <div className="flex gap-2 text-xs text-gray-200">
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="drivers_license_required"
                value="YES"
                checked={form.driversLicenseRequired === "YES"}
                onChange={() => setForm((prev) => ({ ...prev, driversLicenseRequired: "YES" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              YES
            </label>
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="drivers_license_required"
                value="NO"
                checked={form.driversLicenseRequired === "NO"}
                onChange={() => setForm((prev) => ({ ...prev, driversLicenseRequired: "NO" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              NO
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            DO YOU HAVE A MEDICAL CARD
          </label>
          <div className="flex gap-2 text-xs text-gray-200">
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="has_medical_card"
                value="YES"
                checked={form.hasMedicalCard === "YES"}
                onChange={() => setForm((prev) => ({ ...prev, hasMedicalCard: "YES" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              YES
            </label>
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="has_medical_card"
                value="NO"
                checked={form.hasMedicalCard === "NO"}
                onChange={() => setForm((prev) => ({ ...prev, hasMedicalCard: "NO" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              NO
            </label>
          </div>
        </div>
      </div>

      {/* Medical card exp + copies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField
          label="MEDICAL CARD EXPIRATION (MM/DD/YYYY)"
          value={form.medicalCardExp}
          onValueChange={(val) => setForm((prev) => ({ ...prev, medicalCardExp: val }))}
          helperText="Required for DOT compliance"
          containerClassName="text-white"
          labelClassName="text-xs tracking-wide text-gray-300"
          className="bg-black/70 border-gray-700 focus:ring-emerald-400/50"
        />

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            COPY OF REGISTRATION
          </label>
          <div className="flex gap-2 text-xs text-gray-200">
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="copy_registration"
                value="YES"
                checked={form.copyOfRegistration === "YES"}
                onChange={() => setForm((prev) => ({ ...prev, copyOfRegistration: "YES" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              YES
            </label>
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="copy_registration"
                value="NO"
                checked={form.copyOfRegistration === "NO"}
                onChange={() => setForm((prev) => ({ ...prev, copyOfRegistration: "NO" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              NO
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">
            COPY OF INSURANCE
          </label>
          <div className="flex gap-2 text-xs text-gray-200">
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="copy_insurance"
                value="YES"
                checked={form.copyOfInsurance === "YES"}
                onChange={() => setForm((prev) => ({ ...prev, copyOfInsurance: "YES" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              YES
            </label>
            <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="copy_insurance"
                value="NO"
                checked={form.copyOfInsurance === "NO"}
                onChange={() => setForm((prev) => ({ ...prev, copyOfInsurance: "NO" }))}
                className="w-4 h-4 accent-emerald-500"
              />
              NO
            </label>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
