/**
 * IncidentLoggingModal - OSHA-Compliant Safety Incident Logging Form
 *
 * Meets OSHA 300 Log and 301 Incident Report requirements.
 * Auto-generates case numbers and detects reportable incidents.
 * Auto-links incidents to matching risk predictions.
 *
 * Constants, types, data fetching, and CollapsibleSection extracted to ./incident/
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertTriangle,
  Calendar,
  Users,
  FileText,
  Check,
  Loader2,
  Search,
  Clock,
  Stethoscope,
  AlertCircle,
  Briefcase,
  Activity,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLogIncident, type IncidentFormData } from "../../hooks/queries/useRiskCalibration";
import { VoiceInputButton } from "../forms/VoiceInputButton";
import { FormSuccessCelebration } from "../forms/FormSuccessCelebration";
import { formToast } from "../../lib/formToast";
import { logger } from "../../lib/logger";
import {
  CollapsibleSection,
  useIncidentFormOptions,
  SEVERITY_OPTIONS,
  INCIDENT_TYPES,
  INJURY_ILLNESS_TYPES,
  BODY_PARTS,
  US_STATES,
  SEX_OPTIONS,
  CONTRIBUTING_FACTORS,
  INITIAL_FORM_STATE,
  INITIAL_DEMOGRAPHICS,
  type DemographicsState,
} from "./incident";

interface IncidentLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentLoggingModal({ isOpen, onClose }: IncidentLoggingModalProps) {
  const logIncidentMutation = useLogIncident();
  
  // Form state
  const [formData, setFormData] = useState<IncidentFormData>(INITIAL_FORM_STATE);
  
  // Section visibility state
  const [openSections, setOpenSections] = useState({
    basic: true,
    traceability: true,
    classification: true,
    narrative: false,
    medical: false,
    daysTracking: false,
    employees: false,
    factors: false,
  });
  
  // Options from extracted hook
  const {
    workSites,
    jobs,
    crews,
    employees,
    filteredEmployees,
    isLoading: isLoadingOptions,
    employeeSearch,
    setEmployeeSearch,
  } = useIncidentFormOptions(isOpen);
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [submittedCaseNumber, setSubmittedCaseNumber] = useState<string | null>(null);
  const [showOshaWarning, setShowOshaWarning] = useState(false);

  const [demographics, setDemographics] = useState<DemographicsState>({ ...INITIAL_DEMOGRAPHICS });

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Determine if this is an OSHA-recordable incident
  const isOshaRecordable = useMemo(() => {
    return ['recordable', 'lost_time', 'fatality'].includes(formData.severity);
  }, [formData.severity]);
  
  // Determine if this requires immediate OSHA reporting (8-24 hour)
  const requiresImmediateReport = useMemo(() => {
    if (formData.severity === 'fatality') return '8 hours';
    if (formData.hospitalized_overnight) return '24 hours';
    return null;
  }, [formData.severity, formData.hospitalized_overnight]);

  // Auto-expand sections based on severity (defer to avoid setState-in-effect lint)
  useEffect(() => {
    if (!isOshaRecordable) return;
    const id = requestAnimationFrame(() => {
      setOpenSections(prev => ({
        ...prev,
        narrative: true,
        medical: true,
        daysTracking: formData.severity === 'lost_time',
      }));
    });
    return () => cancelAnimationFrame(id);
  }, [isOshaRecordable, formData.severity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.description.trim()) {
      alert('Please provide a description of the incident.');
      return;
    }
    
    // Validate OSHA-required fields for recordable incidents
    if (isOshaRecordable) {
      if (formData.body_parts_affected.length === 0) {
        alert('Please select at least one body part affected (required for OSHA recordable incidents).');
        return;
      }
      if (!formData.what_doing_before.trim()) {
        alert('Please describe what the employee was doing before the incident (required for OSHA 301).');
        return;
      }
    }

    // Show OSHA warning for reportable incidents
    if (requiresImmediateReport && !showOshaWarning) {
      setShowOshaWarning(true);
      return;
    }

    try {
      const payload = {
        ...formData,
        ...(isOshaRecordable && {
          employee_street_address: demographics.employee_street_address || null,
          employee_city: demographics.employee_city || null,
          employee_state: demographics.employee_state || null,
          employee_zip: demographics.employee_zip || null,
          employee_date_of_birth: demographics.employee_date_of_birth || null,
          employee_sex: demographics.employee_sex,
          privacy_case: demographics.privacy_case,
        }),
        ...(formData.severity === 'fatality' && {
          date_of_death: demographics.date_of_death || null,
        }),
      };
      const result = await logIncidentMutation.mutateAsync(payload as IncidentFormData);

      // Store case number for celebration
      setSubmittedCaseNumber(result.case_number);

      // Show celebration
      setShowCelebration(true);

      // Reset form
      setFormData(INITIAL_FORM_STATE);
      setDemographics({ ...INITIAL_DEMOGRAPHICS });
      setShowOshaWarning(false);
    } catch (error) {
      logger.error('Error logging incident:', error);
      formToast.error('Submission Failed', 'Failed to log incident. Please try again.');
    }
  };
  
  const handleCelebrationContinue = () => {
    setShowCelebration(false);
    setSubmittedCaseNumber(null);
    onClose();
  };

  const handleWorkSiteChange = (siteId: string) => {
    const site = workSites.find(s => s.id === siteId);
    setFormData(prev => ({
      ...prev,
      work_site_id: siteId || null,
      work_site_name: site?.name || null,
    }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleContributingFactor = (factor: string) => {
    setFormData(prev => ({
      ...prev,
      contributing_factors: prev.contributing_factors.includes(factor)
        ? prev.contributing_factors.filter(f => f !== factor)
        : [...prev.contributing_factors, factor],
    }));
  };

  const toggleBodyPart = (part: string) => {
    setFormData(prev => ({
      ...prev,
      body_parts_affected: prev.body_parts_affected.includes(part)
        ? prev.body_parts_affected.filter(p => p !== part)
        : [...prev.body_parts_affected, part],
    }));
  };

  const toggleInvolvedUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      involved_user_ids: prev.involved_user_ids.includes(userId)
        ? prev.involved_user_ids.filter(id => id !== userId)
        : [...prev.involved_user_ids, userId],
    }));
  };

  if (!isOpen && !showCelebration) return null;

  return (
    <>
      {/* Success Celebration */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="incident"
        title="Incident Logged Successfully!"
        message={submittedCaseNumber 
          ? `Case #${submittedCaseNumber} has been recorded. ${requiresImmediateReport ? `Remember: This incident must be reported to OSHA within ${requiresImmediateReport}.` : ''}`
          : "Thank you for reporting this safety incident. Your report helps us improve workplace safety and prevent future incidents."
        }
        onContinue={handleCelebrationContinue}
      />

      {/* OSHA Reporting Warning Modal */}
      <AnimatePresence>
        {showOshaWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-xl bg-red-950 border border-red-500/50"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    OSHA Reporting Required
                  </h3>
                  <p className="text-sm text-white/70 mb-4">
                    {formData.severity === 'fatality' 
                      ? 'Fatalities must be reported to OSHA within 8 hours.'
                      : 'Hospitalizations must be reported to OSHA within 24 hours.'}
                  </p>
                  <p className="text-xs text-white/50 mb-4">
                    Call OSHA at 1-800-321-OSHA (6742) or report online at osha.gov/opa/electronic-reporting
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowOshaWarning(false)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                    >
                      I Understand, Submit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Modal */}
      <AnimatePresence>
        {isOpen && !showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="incident-modal-title"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-[#140a0a] via-[#0a0505] to-[#020205]"
            >
              {/* Compact Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 id="incident-modal-title" className="text-sm font-semibold text-white">Log Incident</h2>
                    <p className="text-[10px] text-white/50">OSHA 300/301 Compliant</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isOshaRecordable && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                      Recordable
                    </span>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                    aria-label="Close incident form"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact Warning Banner */}
              {requiresImmediateReport && (
                <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20">
                  <div className="flex items-center gap-1.5 text-red-300">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[10px] font-medium">
                      OSHA notification required within {requiresImmediateReport}
                    </span>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="p-3 overflow-y-auto max-h-[calc(85vh-100px)]">
                <div className="space-y-2.5">
                  
                  {/* ========== BASIC INFORMATION - COMPACT ========== */}
                  <CollapsibleSection
                    title="When & Where"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    isOpen={openSections.basic}
                    onToggle={() => toggleSection('basic')}
                    required
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {/* Date */}
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">Date *</label>
                        <input
                          type="date"
                          value={formData.incident_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
                          max={new Date().toISOString().split('T')[0]}
                          required
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      {/* Time */}
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">Time {isOshaRecordable && '*'}</label>
                        <input
                          type="time"
                          value={formData.incident_time || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, incident_time: e.target.value || null }))}
                          required={isOshaRecordable}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      {/* Work Site - Full Width */}
                      <div className="col-span-2">
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">
                          Work Site {isOshaRecordable && '*'}
                        </label>
                        <select
                          value={formData.work_site_id || ""}
                          onChange={(e) => handleWorkSiteChange(e.target.value)}
                          required={isOshaRecordable}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        >
                          <option value="">Select site</option>
                          {workSites.map((site) => (
                            <option key={site.id} value={site.id}>{site.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* ========== JOB / CREW / SUPERVISOR (Traceability) ========== */}
                  <CollapsibleSection
                    title="Job / Crew / Supervisor"
                    icon={<Briefcase className="w-3.5 h-3.5" />}
                    isOpen={openSections.traceability}
                    onToggle={() => toggleSection('traceability')}
                  >
                    <p className="text-[10px] text-white/50 mb-2">
                      Optional. Links incident to job and crew for insurer/regulator traceability.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">Job</label>
                        <select
                          value={formData.job_id || ""}
                          onChange={(e) => {
                            const jobId = e.target.value || null;
                            const job = jobs.find((j) => j.id === jobId);
                            setFormData((prev) => ({
                              ...prev,
                              job_id: jobId,
                              crew_id: job?.crew_id ?? prev.crew_id,
                            }));
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        >
                          <option value="">None</option>
                          {jobs.map((job) => (
                            <option key={job.id} value={job.id}>
                              {job.circuit || job.job_location || job.id.slice(0, 8)}
                              {job.start_date ? ` (${job.start_date})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">Crew</label>
                        <select
                          value={formData.crew_id || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, crew_id: e.target.value || null }))
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        >
                          <option value="">None</option>
                          {crews.map((crew) => (
                            <option key={crew.id} value={crew.id}>{crew.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1 block">Supervisor</label>
                        <select
                          value={formData.supervisor_id || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, supervisor_id: e.target.value || null }))
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                        >
                          <option value="">None</option>
                          {employees
                            .filter(
                              (emp) =>
                                ["admin", "general_foreman", "foreman", "safety_officer"].includes(
                                  emp.role
                                )
                            )
                            .map((emp) => (
                              <option key={emp.user_id} value={emp.user_id}>
                                {emp.full_name ?? emp.user_id}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* ========== CLASSIFICATION - COMPACT ========== */}
                  <CollapsibleSection
                    title="Severity & Type"
                    icon={<Activity className="w-3.5 h-3.5" />}
                    isOpen={openSections.classification}
                    onToggle={() => toggleSection('classification')}
                    required
                    badge={isOshaRecordable ? "OSHA" : undefined}
                    badgeColor="amber"
                  >
                    {/* Severity - Compact Pills */}
                    <div>
                      <label className="text-[10px] font-medium text-white/70 mb-1.5 block">Severity *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {SEVERITY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, severity: option.value }))}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                              formData.severity === option.value
                                ? option.color === "amber" ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                : option.color === "blue" ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                : option.color === "orange" ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                                : "bg-red-500/20 border-red-500/50 text-red-300"
                                : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Incident Type - Compact */}
                    <div>
                      <label className="text-[10px] font-medium text-white/70 mb-1.5 block">Type *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {INCIDENT_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, incident_type: type.value }))}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                              formData.incident_type === type.value
                                ? "bg-white/10 border-white/30 text-white"
                                : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Injury/Illness Type - Show only for recordable */}
                    {isOshaRecordable && (
                      <div>
                        <label className="text-[10px] font-medium text-white/70 mb-1.5 block">Injury/Illness *</label>
                        <div className="flex flex-wrap gap-1.5">
                          {INJURY_ILLNESS_TYPES.map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, injury_illness_type: type.value }))}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                                formData.injury_illness_type === type.value
                                  ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                  : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                              )}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* ========== NARRATIVE - COMPACT ========== */}
                  <CollapsibleSection
                    title="What Happened"
                    icon={<FileText className="w-3.5 h-3.5" />}
                    isOpen={openSections.narrative}
                    onToggle={() => toggleSection('narrative')}
                    required
                  >
                    {/* Description */}
                    <div>
                      <label className="text-[10px] font-medium text-white/70 mb-1 block">Description *</label>
                      <div className="relative">
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="What happened?"
                          rows={2}
                          required
                          className="w-full px-2 py-1.5 pr-10 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 resize-none placeholder:text-white/30"
                        />
                        <div className="absolute right-1.5 top-1.5">
                          <VoiceInputButton
                            onTranscript={(text) => setFormData(prev => ({ ...prev, description: text }))}
                            currentValue={formData.description}
                            appendMode={true}
                            size="sm"
                            className="bg-red-500/10 hover:bg-red-500/20 focus:ring-red-500/40 !p-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* OSHA-required fields - Show only for recordable */}
                    {isOshaRecordable && (
                      <>
                        <div>
                          <label className="text-[10px] font-medium text-white/70 mb-1 block">Activity before incident *</label>
                          <input
                            type="text"
                            value={formData.what_doing_before}
                            onChange={(e) => setFormData(prev => ({ ...prev, what_doing_before: e.target.value }))}
                            placeholder="e.g., Climbing ladder"
                            required={isOshaRecordable}
                            className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-white/70 mb-1 block">Object/substance that caused harm *</label>
                          <input
                            type="text"
                            value={formData.object_substance_harmed}
                            onChange={(e) => setFormData(prev => ({ ...prev, object_substance_harmed: e.target.value }))}
                            placeholder="e.g., Chainsaw, branch, floor"
                            required={isOshaRecordable}
                            className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                        </div>
                      </>
                    )}

                    {/* Body Parts - Compact */}
                    <div>
                      <label className="text-[10px] font-medium text-white/70 mb-1 block">
                        Body part(s) {isOshaRecordable && '*'}
                      </label>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                        {BODY_PARTS.map((part) => (
                          <button
                            key={part.value}
                            type="button"
                            onClick={() => toggleBodyPart(part.value)}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
                              formData.body_parts_affected.includes(part.value)
                                ? "bg-red-500/20 border-red-500/50 text-red-300"
                                : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                            )}
                          >
                            {part.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* ========== MEDICAL - COMPACT ========== */}
                  <CollapsibleSection
                    title="Medical Treatment"
                    icon={<Stethoscope className="w-3.5 h-3.5" />}
                    isOpen={openSections.medical}
                    onToggle={() => toggleSection('medical')}
                    badge={formData.hospitalized_overnight ? "24hr" : undefined}
                    badgeColor="red"
                  >
                    {/* Compact Toggles */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, emergency_room_treatment: !prev.emergency_room_treatment }))}
                        className={cn(
                          "flex-1 px-2 py-2 rounded-lg text-[10px] font-medium border transition-all text-center",
                          formData.emergency_room_treatment
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                            : "bg-white/5 border-white/10 text-white/50"
                        )}
                      >
                        {formData.emergency_room_treatment && <Check className="w-3 h-3 inline mr-1" />}
                        ER Visit
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, hospitalized_overnight: !prev.hospitalized_overnight }))}
                        className={cn(
                          "flex-1 px-2 py-2 rounded-lg text-[10px] font-medium border transition-all text-center",
                          formData.hospitalized_overnight
                            ? "bg-red-500/20 border-red-500/50 text-red-300"
                            : "bg-white/5 border-white/10 text-white/50"
                        )}
                      >
                        {formData.hospitalized_overnight && <Check className="w-3 h-3 inline mr-1" />}
                        Hospitalized
                      </button>
                    </div>

                    {/* Provider fields - Compact */}
                    {(formData.emergency_room_treatment || formData.hospitalized_overnight) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-white/70 mb-1 block">Physician</label>
                          <input
                            type="text"
                            value={formData.physician_name || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, physician_name: e.target.value || null }))}
                            placeholder="Dr. Name"
                            className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-white/70 mb-1 block">Facility</label>
                          <input
                            type="text"
                            value={formData.treatment_facility || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, treatment_facility: e.target.value || null }))}
                            placeholder="Hospital"
                            className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                        </div>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* ========== DAYS TRACKING (OSHA 300) - Only for Lost Time ========== */}
                  {['lost_time', 'recordable'].includes(formData.severity) && (
                    <CollapsibleSection
                      title="Days Away / Restricted Duty"
                      icon={<Clock className="w-4 h-4" />}
                      isOpen={openSections.daysTracking}
                      onToggle={() => toggleSection('daysTracking')}
                      badge="OSHA 300"
                      badgeColor="amber"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-white/80 mb-1.5 block">
                            Days Away From Work
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.days_away_from_work || ''}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              days_away_from_work: e.target.value ? parseInt(e.target.value) : null 
                            }))}
                            placeholder="0"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                          <p className="mt-1 text-xs text-white/40">Calendar days (exclude day of injury)</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-white/80 mb-1.5 block">
                            Days of Restricted Duty
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.days_restricted_duty || ''}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              days_restricted_duty: e.target.value ? parseInt(e.target.value) : null 
                            }))}
                            placeholder="0"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                          <p className="mt-1 text-xs text-white/40">Days on light/modified duty</p>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* ========== EMPLOYEE INFORMATION (OSHA 300/301) ========== */}
                  <CollapsibleSection
                    title="Employee Information"
                    icon={<Users className="w-4 h-4" />}
                    isOpen={openSections.employees}
                    onToggle={() => toggleSection('employees')}
                    badge={formData.involved_user_ids.length > 0 ? `${formData.involved_user_ids.length} selected` : undefined}
                  >
                    {/* Job Title & Time (OSHA 300/301) */}
                    {isOshaRecordable && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-sm font-medium text-white/80 mb-1.5 block">
                            Employee Job Title *
                          </label>
                          <input
                            type="text"
                            value={formData.employee_job_title || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, employee_job_title: e.target.value || null }))}
                            placeholder="e.g., Tree Trimmer, Equipment Operator"
                            required={isOshaRecordable}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-white/80 mb-1.5 block">
                            Time Began Work That Day
                          </label>
                          <input
                            type="time"
                            value={formData.time_began_work || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, time_began_work: e.target.value || null }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Involved Employees */}
                    <div>
                      <label className="text-sm font-medium text-white/80 mb-2 block">
                        Involved Employees
                      </label>
                      {isLoadingOptions ? (
                        <div className="flex items-center justify-center py-4 text-white/40 rounded-lg bg-white/5 border border-white/10">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading employees...
                        </div>
                      ) : employees.length === 0 ? (
                        <div className="flex items-center justify-center py-4 text-white/40 rounded-lg bg-white/5 border border-white/10">
                          <Users className="w-4 h-4 mr-2" />
                          No employees found
                        </div>
                      ) : (
                        <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                          <div className="relative border-b border-white/10">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                              type="text"
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                              placeholder="Search employees..."
                              className="w-full pl-9 pr-3 py-2 bg-transparent text-white text-sm placeholder:text-white/30 focus:outline-none"
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto p-2">
                            {filteredEmployees.length === 0 ? (
                              <p className="text-xs text-white/40 text-center py-2">
                                No employees match "{employeeSearch}"
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {filteredEmployees.map((emp) => (
                                  <button
                                    key={emp.user_id}
                                    type="button"
                                    onClick={() => toggleInvolvedUser(emp.user_id)}
                                    className={cn(
                                      "px-2 py-1.5 rounded text-xs text-left transition-all truncate flex items-center gap-1",
                                      formData.involved_user_ids.includes(emp.user_id)
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        : "hover:bg-white/5 text-white/60 border border-transparent"
                                    )}
                                  >
                                    {formData.involved_user_ids.includes(emp.user_id) && (
                                      <Check className="w-3 h-3 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{emp.full_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* OSHA 301: Employee Demographics (recordable only) */}
                      {isOshaRecordable && (
                        <div className="space-y-3 pt-3 border-t border-white/10">
                          <p className="text-[10px] font-medium text-white/70">Employee Demographics (OSHA 301)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">Street Address</label>
                              <input
                                type="text"
                                autoComplete="street-address"
                                value={demographics.employee_street_address}
                                onChange={(e) => setDemographics((p) => ({ ...p, employee_street_address: e.target.value }))}
                                placeholder="123 Main St"
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">City</label>
                              <input
                                type="text"
                                autoComplete="address-level2"
                                value={demographics.employee_city}
                                onChange={(e) => setDemographics((p) => ({ ...p, employee_city: e.target.value }))}
                                placeholder="City"
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">State</label>
                              <select
                                autoComplete="address-level1"
                                value={demographics.employee_state}
                                onChange={(e) => setDemographics((p) => ({ ...p, employee_state: e.target.value }))}
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                              >
                                <option value="">Select</option>
                                {US_STATES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">ZIP</label>
                              <input
                                type="text"
                                autoComplete="postal-code"
                                value={demographics.employee_zip}
                                onChange={(e) => setDemographics((p) => ({ ...p, employee_zip: e.target.value }))}
                                placeholder="ZIP"
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder:text-white/30"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">Date of Birth</label>
                              <input
                                type="date"
                                autoComplete="bday"
                                value={demographics.employee_date_of_birth}
                                onChange={(e) => setDemographics((p) => ({ ...p, employee_date_of_birth: e.target.value }))}
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">Sex</label>
                              <div className="flex flex-wrap gap-2">
                                {SEX_OPTIONS.map((opt) => (
                                  <label key={opt.value} className="flex items-center gap-1 text-xs text-white/80 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="employee_sex"
                                      value={opt.value}
                                      checked={demographics.employee_sex === opt.value}
                                      onChange={() => setDemographics((p) => ({ ...p, employee_sex: opt.value }))}
                                      className="rounded border-white/20"
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                          {formData.severity === 'fatality' && (
                            <div>
                              <label className="text-[10px] font-medium text-white/70 mb-1 block">Date of Death</label>
                              <input
                                type="date"
                                value={demographics.date_of_death}
                                onChange={(e) => setDemographics((p) => ({ ...p, date_of_death: e.target.value }))}
                                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="privacy_case"
                              checked={demographics.privacy_case}
                              onChange={(e) => setDemographics((p) => ({ ...p, privacy_case: e.target.checked }))}
                              className="rounded border-white/20"
                            />
                            <label htmlFor="privacy_case" className="text-[10px] text-white/70">
                              Privacy concern case — do not enter employee name on OSHA 300 Log (29 CFR 1904.12)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>

                  {/* ========== CONTRIBUTING FACTORS (Internal Use) ========== */}
                  <CollapsibleSection
                    title="Contributing Factors & Internal Analysis"
                    icon={<Briefcase className="w-4 h-4" />}
                    isOpen={openSections.factors}
                    onToggle={() => toggleSection('factors')}
                  >
                    {/* Contributing Factors */}
                    <div>
                      <label className="text-sm font-medium text-white/80 mb-2 block">Contributing Factors</label>
                      <div className="flex flex-wrap gap-2">
                        {CONTRIBUTING_FACTORS.map((factor) => (
                          <button
                            key={factor.value}
                            type="button"
                            onClick={() => toggleContributingFactor(factor.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                              formData.contributing_factors.includes(factor.value)
                                ? "bg-red-500/20 border-red-500/50 text-red-300"
                                : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                            )}
                          >
                            {formData.contributing_factors.includes(factor.value) && (
                              <Check className="w-3 h-3 inline mr-1" />
                            )}
                            {factor.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preventable Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <div>
                        <p className="text-sm font-medium text-white">Preventable Incident</p>
                        <p className="text-xs text-white/40">Could this have been prevented?</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, preventable: !prev.preventable }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          formData.preventable ? "bg-red-500" : "bg-white/20"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                            formData.preventable ? "translate-x-7" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  </CollapsibleSection>

                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-white/10">
                  <div className="text-xs text-white/40">
                    {isOshaRecordable && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Case number will be auto-generated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="incident-logging-submit"
                      disabled={logIncidentMutation.isPending || !formData.description.trim()}
                      className={cn(
                        "px-6 py-2 rounded-lg text-sm font-medium transition-all",
                        "bg-red-500/20 text-red-300 border border-red-500/30",
                        "hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center gap-2",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                      )}
                    >
                      {logIncidentMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          Log Incident
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
