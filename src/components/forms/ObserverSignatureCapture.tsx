import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Briefcase, PenLine, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ObserverSignature } from "../../pages/forms/DailyJSAForm";

interface ObserverSignatureCaptureProps {
  observers: ObserverSignature[];
  onAddObserver: (observer: ObserverSignature) => void;
  onDeleteObserver: (timestamp: string) => void;
  className?: string;
}

const ROLE_OPTIONS = [
  { value: "", label: "Select role (optional)" },
  { value: "Foreman", label: "Foreman" },
  { value: "General Foreman", label: "General Foreman" },
  { value: "Safety Officer", label: "Safety Officer" },
  { value: "Crew Lead", label: "Crew Lead" },
  { value: "Observer", label: "Observer" },
  { value: "Other", label: "Other" },
];

interface ValidationErrors {
  name: string;
  signature: string;
}

export function ObserverSignatureCapture({
  observers,
  onAddObserver,
  onDeleteObserver,
  className,
}: ObserverSignatureCaptureProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [signature, setSignature] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({ name: "", signature: "" });
  const [showForm, setShowForm] = useState(false);

  const validate = (): boolean => {
    const newErrors: ValidationErrors = { name: "", signature: "" };
    
    if (!name.trim()) {
      newErrors.name = "Observer name is required";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must be 100 characters or less";
    }
    
    if (!signature.trim()) {
      newErrors.signature = "Signature is required";
    }
    
    setErrors(newErrors);
    return !newErrors.name && !newErrors.signature;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const newObserver: ObserverSignature = {
      name: name.trim(),
      signature_data: signature.trim(),
      timestamp: new Date().toISOString(),
      role: role || undefined,
    };

    onAddObserver(newObserver);
    
    // Reset form
    setName("");
    setRole("");
    setSignature("");
    setErrors({ name: "", signature: "" });
    setShowForm(false);
  };

  const handleCancel = () => {
    setName("");
    setRole("");
    setSignature("");
    setErrors({ name: "", signature: "" });
    setShowForm(false);
  };

  const handleDelete = (observer: ObserverSignature) => {
    const rolePart = observer.role ? ` (${observer.role})` : "";
    if (window.confirm(`Delete signature by ${observer.name}${rolePart}?`)) {
      onDeleteObserver(observer.timestamp);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-300" />
            Observer Signatures
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Optional: Add crew leads, foremen, or safety officers who reviewed this JSA
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/40 transition text-sm font-medium touch-manipulation min-h-[44px]"
          >
            <PenLine className="w-4 h-4" />
            Add Observer
          </button>
        )}
      </div>

      {/* Add Observer Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div 
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-4"
              style={{ boxShadow: 'inset 0px 2px 15px 8px rgba(0, 0, 0, 0.85)' }}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                New Observer Signature
              </p>

              {/* Name Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white">
                  Observer Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: "" });
                    }}
                    placeholder="Enter observer's full name"
                    className={cn(
                      "w-full rounded-lg border bg-black/50 pl-10 pr-3 py-3 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-all min-h-[44px]",
                      errors.name
                        ? "border-red-500/50 focus:ring-red-500/50"
                        : "border-white/10 focus:ring-emerald-500/50"
                    )}
                    maxLength={100}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-300">{errors.name}</p>
                )}
              </div>

              {/* Role Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white">
                  Role (Optional)
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/50 pl-10 pr-3 py-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none min-h-[44px]"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Signature Input (Handwriting Font) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white">
                  Signature <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <PenLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => {
                      setSignature(e.target.value);
                      if (errors.signature) setErrors({ ...errors, signature: "" });
                    }}
                    placeholder="Type observer's signature"
                    className={cn(
                      "w-full rounded-lg border bg-black/50 pl-10 pr-3 py-3 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-all min-h-[44px]",
                      errors.signature
                        ? "border-red-500/50 focus:ring-red-500/50"
                        : "border-white/10 focus:ring-emerald-500/50"
                    )}
                    style={{ fontFamily: "Caveat, cursive" }}
                  />
                </div>
                {errors.signature && (
                  <p className="text-xs text-red-300">{errors.signature}</p>
                )}
                <p className="text-[10px] text-white/50">
                  Signature will appear in handwriting font
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition touch-manipulation min-h-[44px]"
                >
                  Save Observer
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:border-white/40 transition touch-manipulation min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Observers List */}
      {observers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Added Observers ({observers.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {observers.map((observer) => (
              <motion.div
                key={observer.timestamp}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                style={{ boxShadow: 'inset 0px 2px 10px 4px rgba(0, 0, 0, 0.85)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {observer.name}
                    </p>
                    {observer.role && (
                      <p className="text-xs text-white/50">{observer.role}</p>
                    )}
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {new Date(observer.timestamp).toLocaleDateString()} at{" "}
                      {new Date(observer.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(observer)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition touch-manipulation"
                    aria-label={`Delete signature by ${observer.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Signature Display */}
                <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
                  <p 
                    className="text-2xl text-white/90 truncate"
                    style={{ fontFamily: "Caveat, cursive" }}
                  >
                    {observer.signature_data}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
