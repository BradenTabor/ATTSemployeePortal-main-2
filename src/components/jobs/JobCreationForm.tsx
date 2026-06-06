import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  MapPin,
  FileText,
  ClipboardList,
  Calendar,
  StickyNote,
  Loader2,
  X,
  Save,
  Target,
  Ruler,
  Users,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { isValidDateRange } from '../../lib/jobProgressUtils';
import { JobCrewSelector } from './JobCrewSelector';
import { JobMilestoneEditor } from './JobMilestoneEditor';
import { useCrews, useCrewDetails } from '../../hooks/useCrews';
import { supabase } from '../../lib/supabaseClient';
import { formToast } from '../../lib/formToast';
import { logger } from '../../lib/logger';
import { FormSuccessCelebration } from '../forms/FormSuccessCelebration';
import { useAuth } from '../../contexts/AuthContext';
import type { JobFormData, MilestoneInput, CrewMember, JobProgressTracker, SpanProgressMetric } from '../../types/jobs';

interface WorkSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
  crew_id: string | null;
}

interface JobCreationFormProps {
  crewMembers: CrewMember[];
  crewLoading?: boolean;
  onSubmit: (data: JobFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  initialData?: JobProgressTracker;
  isEditing?: boolean;
}

const EMPTY_FORM: JobFormData = {
  job_name: '',
  job_location: '',
  circuit: '',
  job_description: '',
  job_specs: '',
  start_date: '',
  end_date: '',
  notes: '',
  milestones: [],
  crew_member_ids: [],
  tracking_type: 'timeline',
  estimated_total_spans: null,
  estimated_total_feet: null,
  span_progress_metric: 'spans',
  work_site_id: null,
  crew_id: null,
};

function JobCreationFormComponent({
  crewMembers,
  crewLoading = false,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}: JobCreationFormProps) {
  const { fullName } = useAuth();
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [createdJobName, setCreatedJobName] = useState('');
  
  // Initialize form with existing data if editing
  const [formData, setFormData] = useState<JobFormData>(() => {
    if (initialData) {
      return {
        job_name: initialData.job_name,
        job_location: initialData.job_location || '',
        circuit: initialData.circuit || initialData.job_location || '',
        job_description: initialData.job_description || '',
        job_specs: initialData.job_specs || '',
        start_date: initialData.start_date || '',
        end_date: initialData.end_date || '',
        notes: initialData.notes || '',
        milestones: initialData.milestones?.map(m => ({
          title: m.title,
          description: m.description || '',
          target_date: m.target_date || '',
          is_completed: m.is_completed,
        })) || [],
        crew_member_ids: initialData.crew_assignments?.map(a => a.user_id) || [],
        tracking_type: initialData.tracking_type || 'timeline',
        estimated_total_spans: initialData.estimated_total_spans ?? null,
        estimated_total_feet: initialData.estimated_total_feet ?? null,
        span_progress_metric: initialData.span_progress_metric || 'spans',
        work_site_id: initialData.work_site_id ?? null,
        crew_id: initialData.crew_id ?? null,
      };
    }
    return EMPTY_FORM;
  });

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Work Sites integration
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    initialData?.work_site_id ?? null
  );

  // Crews integration
  const { crews, loading: crewsLoading } = useCrews();
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(
    initialData?.crew_id ?? null
  );
  const { crew: selectedCrewDetails } = useCrewDetails(selectedCrewId);

  // Fetch work sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const { data, error } = await supabase
          .from('work_sites')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setWorkSites(data || []);
      } catch (err) {
        logger.error('[JobCreationForm] Failed to fetch work sites:', err);
        formToast.error('Load Failed', 'Failed to load work sites. You can still create a job manually.');
      } finally {
        setSitesLoading(false);
      }
    };
    fetchSites();
  }, []);

  // Auto-fill job_location when work site is selected
  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId) {
      const site = workSites.find(s => s.id === siteId);
      if (site) {
        setFormData(prev => ({
          ...prev,
          job_location: site.address || site.name,
          work_site_id: siteId, // Link job to work site for Safety Forecast
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        work_site_id: null,
      }));
    }
  }, [workSites]);

  // Auto-fill crew_member_ids when crew is selected
  // Must also handle crews with zero members to avoid stale data from previous selection
  useEffect(() => {
    // Only update when:
    // 1. We have a selected crew ID
    // 2. The crew details are loaded
    // 3. The loaded details actually belong to the selected crew (prevents race condition
    //    where selectedCrewId changes but selectedCrewDetails still has stale data)
    if (selectedCrewId && selectedCrewDetails && selectedCrewDetails.id === selectedCrewId) {
      const memberIds = selectedCrewDetails.members?.map(m => m.user_id) || [];
      setFormData(prev => ({
        ...prev,
        crew_member_ids: memberIds,
      }));
    }
  }, [selectedCrewId, selectedCrewDetails]);

  const handleCrewChange = useCallback((crewId: string | null) => {
    setSelectedCrewId(crewId);
    if (!crewId) {
      // Clear crew members and crew_id if no crew selected
      setFormData(prev => ({ ...prev, crew_member_ids: [], crew_id: null }));
    } else {
      // Set crew_id for Safety Forecast integration
      setFormData(prev => ({ ...prev, crew_id: crewId }));
    }
  }, []);

  const updateField = useCallback(<K extends keyof JobFormData>(
    field: K,
    value: JobFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [validationErrors]);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.job_name.trim()) {
      errors.job_name = 'Job name is required';
    }

    if (formData.tracking_type === 'timeline') {
      if (!formData.start_date) {
        errors.start_date = 'Start date is required for timeline tracking';
      }

      if (!formData.end_date) {
        errors.end_date = 'End date is required for timeline tracking';
      }

      if (formData.start_date && formData.end_date && !isValidDateRange(formData.start_date, formData.end_date)) {
        errors.end_date = 'End date must be after start date';
      }
    }

    // Validate span-based tracking estimates
    if (formData.tracking_type === 'job_progress') {
      if (formData.span_progress_metric === 'spans') {
        if (!formData.estimated_total_spans || formData.estimated_total_spans <= 0) {
          errors.estimated_total_spans = 'Estimated total spans is required for span-based tracking';
        }
      } else if (formData.span_progress_metric === 'feet') {
        if (!formData.estimated_total_feet || formData.estimated_total_feet <= 0) {
          errors.estimated_total_feet = 'Estimated total feet is required for span-based tracking';
        }
      }
    }

    // Validate milestones have titles
    const invalidMilestones = formData.milestones.filter(m => !m.title.trim());
    if (invalidMilestones.length > 0) {
      errors.milestones = 'All milestones must have a title';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // QA-003: Prevent duplicate submissions — atomic ref guard (same pattern as DVIRForm, DailyJSAForm)
    if (submittingRef.current || submitting) {
      logger.warn('[JobCreationForm] Submit already in progress, ignoring duplicate submit');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await formToast.submitting(isEditing ? 'Saving changes...' : 'Creating job...');

      const result = await onSubmit(formData);

      if (!result.success) {
        setError(result.error || 'An error occurred');
        formToast.error(
          isEditing ? 'Update Failed' : 'Creation Failed',
          result.error || 'An error occurred. Please try again.',
          { onRetry: () => handleSubmit(e) }
        );
      } else {
        formToast.dismiss();
        setCreatedJobName(formData.job_name);
        setShowCelebration(true);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  
  // Handle celebration continue
  const handleCelebrationContinue = useCallback(() => {
    setShowCelebration(false);
    onCancel(); // Close the form after celebration
  }, [onCancel]);

  const inputClassName = cn(
    'w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3',
    'text-white placeholder:text-white/30 text-sm',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  const labelClassName = 'text-[11px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2';

  return (
    <>
      {/* Success Celebration */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="equipment" // Using 'equipment' for green theme
        title={isEditing ? "Job Updated!" : "Job Created!"}
        message={isEditing 
          ? `"${createdJobName}" has been successfully updated.`
          : `"${createdJobName}" has been created and is ready for tracking.`
        }
        onContinue={handleCelebrationContinue}
        userName={fullName || undefined}
      />
      
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4 sm:space-y-6"
      >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4c979] flex-shrink-0" />
          <span className="truncate">{isEditing ? 'Edit Job' : 'Create New Job'}</span>
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 sm:p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Close job form"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs sm:text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Job Name */}
      <div>
        <label className={labelClassName}>
          <Briefcase className="w-4 h-4 text-[#f4c979]" />
          Job Name *
        </label>
        <input
          type="text"
          value={formData.job_name}
          onChange={(e) => updateField('job_name', e.target.value)}
          placeholder="Enter job name..."
          disabled={submitting}
          className={cn(inputClassName, validationErrors.job_name && 'border-red-500/50')}
        />
        {validationErrors.job_name && (
          <p className="mt-1 text-xs text-red-400">{validationErrors.job_name}</p>
        )}
      </div>

      {/* Quick Assignment Section */}
      {!isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl sm:rounded-2xl border border-[#f4c979]/20 bg-[#f4c979]/5 p-3 sm:p-4 space-y-3 sm:space-y-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#f4c979]/80">
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Quick Assignment (Optional)
          </div>
          <p className="text-[11px] sm:text-xs text-white/50 -mt-1 sm:-mt-2">
            Select a work site and/or crew to auto-fill location and team members.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Work Site Dropdown */}
            <div>
              <label className={labelClassName}>
                <Building2 className="w-4 h-4 text-[#f4c979]" />
                Work Site
              </label>
              <div className="relative">
                <select
                  value={selectedSiteId || ''}
                  onChange={(e) => handleSiteChange(e.target.value || null)}
                  disabled={submitting || sitesLoading}
                  className={cn(
                    inputClassName,
                    'appearance-none cursor-pointer pr-10',
                    !selectedSiteId && 'text-white/30'
                  )}
                >
                  <option value="">Select work site...</option>
                  {workSites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f4c979]/60 pointer-events-none" />
              </div>
              {selectedSiteId && (
                <p className="mt-1 text-xs text-emerald-400/80">
                  Location will be set from site address
                </p>
              )}
            </div>

            {/* Crew Dropdown */}
            <div>
              <label className={labelClassName}>
                <Users className="w-4 h-4 text-[#f4c979]" />
                Assign Crew
              </label>
              <div className="relative">
                <select
                  value={selectedCrewId || ''}
                  onChange={(e) => handleCrewChange(e.target.value || null)}
                  disabled={submitting || crewsLoading}
                  className={cn(
                    inputClassName,
                    'appearance-none cursor-pointer pr-10',
                    !selectedCrewId && 'text-white/30'
                  )}
                >
                  <option value="">Select crew...</option>
                  {crews.filter(c => c.is_active).map(crew => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name} ({crew.member_count || 0} members)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f4c979]/60 pointer-events-none" />
              </div>
              {selectedCrewId && selectedCrewDetails && (
                <p className="mt-1 text-xs text-emerald-400/80">
                  {selectedCrewDetails.members?.length || 0} member(s) will be assigned
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tracking Mode */}
      <div>
        <label className={labelClassName}>
          <Target className="w-4 h-4 text-[#f4c979]" />
          Tracking Mode *
        </label>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-1.5 sm:mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tracking_type"
              value="timeline"
              checked={formData.tracking_type === 'timeline'}
              onChange={() => updateField('tracking_type', 'timeline')}
              disabled={submitting}
              className="w-4 h-4 text-[#f4c979] border-white/20 bg-[#050402]"
            />
            <span className="text-xs sm:text-sm text-white/80">Timeline Progress (Date-based)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tracking_type"
              value="job_progress"
              checked={formData.tracking_type === 'job_progress'}
              onChange={() => updateField('tracking_type', 'job_progress')}
              disabled={submitting}
              className="w-4 h-4 text-[#f4c979] border-white/20 bg-[#050402]"
            />
            <span className="text-xs sm:text-sm text-white/80">Job Progress (Span-based)</span>
          </label>
        </div>
        <p className="text-[11px] sm:text-xs text-white/40 mt-0.5 sm:mt-1">
          {formData.tracking_type === 'timeline'
            ? 'Progress calculated based on start/end dates'
            : 'Progress tracked by crew span completion updates'}
        </p>
      </div>

      {/* Span-based Tracking Configuration */}
      {formData.tracking_type === 'job_progress' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl sm:rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4 space-y-3 sm:space-y-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-blue-300/80">
            <Ruler className="w-4 h-4" />
            Span Progress Configuration
          </div>

          {/* Progress Metric Selection */}
          <div>
            <label className={labelClassName}>
              <Target className="w-4 h-4 text-[#f4c979]" />
              Progress Metric *
            </label>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="span_progress_metric"
                  value="spans"
                  checked={formData.span_progress_metric === 'spans'}
                  onChange={() => updateField('span_progress_metric', 'spans' as SpanProgressMetric)}
                  disabled={submitting}
                  className="w-4 h-4 text-[#f4c979] border-white/20 bg-[#050402]"
                />
                <span className="text-sm text-white/80">Track by # of Spans</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="span_progress_metric"
                  value="feet"
                  checked={formData.span_progress_metric === 'feet'}
                  onChange={() => updateField('span_progress_metric', 'feet' as SpanProgressMetric)}
                  disabled={submitting}
                  className="w-4 h-4 text-[#f4c979] border-white/20 bg-[#050402]"
                />
                <span className="text-sm text-white/80">Track by Total Feet</span>
              </label>
            </div>
          </div>

          {/* Estimated Total Spans */}
          {formData.span_progress_metric === 'spans' && (
            <div>
              <label className={labelClassName}>
                <Target className="w-4 h-4 text-[#f4c979]" />
                Estimated Total Spans *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.estimated_total_spans ?? ''}
                onChange={(e) => updateField('estimated_total_spans', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="e.g., 150"
                disabled={submitting}
                className={cn(inputClassName, validationErrors.estimated_total_spans && 'border-red-500/50')}
              />
              {validationErrors.estimated_total_spans && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.estimated_total_spans}</p>
              )}
              <p className="mt-1 text-xs text-white/40">
                Total number of spans expected for this job. Progress will be calculated as completed spans / estimated spans.
              </p>
            </div>
          )}

          {/* Estimated Total Feet */}
          {formData.span_progress_metric === 'feet' && (
            <div>
              <label className={labelClassName}>
                <Ruler className="w-4 h-4 text-[#f4c979]" />
                Estimated Total Feet *
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={formData.estimated_total_feet ?? ''}
                onChange={(e) => updateField('estimated_total_feet', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 25000"
                disabled={submitting}
                className={cn(inputClassName, validationErrors.estimated_total_feet && 'border-red-500/50')}
              />
              {validationErrors.estimated_total_feet && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.estimated_total_feet}</p>
              )}
              <p className="mt-1 text-xs text-white/40">
                Total feet expected for this job. Progress will be calculated as completed feet / estimated feet.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Circuit */}
      <div>
        <label className={labelClassName}>
          <MapPin className="w-4 h-4 text-[#f4c979]" />
          Circuit
        </label>
        <input
          type="text"
          value={formData.circuit}
          onChange={(e) => {
            const value = e.target.value;
            setFormData(prev => ({
              ...prev,
              circuit: value,
              job_location: value, // keep legacy field in sync
            }));
            if (validationErrors.circuit) {
              setValidationErrors(prev => {
                const next = { ...prev };
                delete next.circuit;
                return next;
              });
            }
          }}
          placeholder="Circuit identifier..."
          disabled={submitting}
          className={inputClassName}
        />
        {!formData.circuit.trim() && (
          <p className="mt-1 text-xs text-amber-300/80">
            Circuit is recommended for span-based tracking and reporting.
          </p>
        )}
      </div>

      {/* Date Range */}
      {formData.tracking_type === 'timeline' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className={labelClassName}>
              <Calendar className="w-4 h-4 text-[#f4c979]" />
              Start Date *
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              disabled={submitting}
              className={cn(
                inputClassName,
                '[color-scheme:dark]',
                validationErrors.start_date && 'border-red-500/50'
              )}
            />
            {validationErrors.start_date && (
              <p className="mt-1 text-xs text-red-400">{validationErrors.start_date}</p>
            )}
          </div>
          <div>
            <label className={labelClassName}>
              <Calendar className="w-4 h-4 text-[#f4c979]" />
              End Date *
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
              min={formData.start_date || undefined}
              disabled={submitting}
              className={cn(
                inputClassName,
                '[color-scheme:dark]',
                validationErrors.end_date && 'border-red-500/50'
              )}
            />
            {validationErrors.end_date && (
              <p className="mt-1 text-xs text-red-400">{validationErrors.end_date}</p>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className={labelClassName}>
          <FileText className="w-4 h-4 text-[#f4c979]" />
          Description
        </label>
        <textarea
          value={formData.job_description}
          onChange={(e) => updateField('job_description', e.target.value)}
          placeholder="Describe the job scope and objectives..."
          disabled={submitting}
          rows={2}
          className={cn(inputClassName, 'resize-none min-h-[4.5rem] sm:min-h-0')}
        />
      </div>

      {/* Specs */}
      <div>
        <label className={labelClassName}>
          <ClipboardList className="w-4 h-4 text-[#f4c979]" />
          Specifications
        </label>
        <textarea
          value={formData.job_specs}
          onChange={(e) => updateField('job_specs', e.target.value)}
          placeholder="Technical specifications, requirements..."
          disabled={submitting}
          rows={2}
          className={cn(inputClassName, 'resize-none min-h-[4.5rem] sm:min-h-0')}
        />
      </div>

      {/* Crew Selector */}
      <JobCrewSelector
        crewMembers={crewMembers}
        selectedIds={formData.crew_member_ids}
        onChange={(ids) => updateField('crew_member_ids', ids)}
        loading={crewLoading}
        disabled={submitting}
      />

      {/* Milestones */}
      <div>
        <JobMilestoneEditor
          milestones={formData.milestones}
          onChange={(milestones) => updateField('milestones', milestones as MilestoneInput[])}
          disabled={submitting}
        />
        {validationErrors.milestones && (
          <p className="mt-2 text-xs text-red-400">{validationErrors.milestones}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className={labelClassName}>
          <StickyNote className="w-4 h-4 text-[#f4c979]" />
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes or comments..."
          disabled={submitting}
          rows={2}
          className={cn(inputClassName, 'resize-none min-h-[3.5rem] sm:min-h-0')}
        />
      </div>

      {/* Actions — stack on mobile for better tap targets */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full sm:w-auto px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl border border-white/20 text-white/80 text-xs sm:text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50 min-h-[44px] hover:scale-[1.02]"
        >
          Cancel
        </button>
        <motion.button
          type="submit"
          disabled={submitting}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px]',
            'bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02]',
            'hover:shadow-[0_0_20px_rgba(244,201,121,0.3)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Save Changes' : 'Create Job'}
            </>
          )}
        </motion.button>
      </div>
    </motion.form>
    </>
  );
}

export const JobCreationForm = memo(JobCreationFormComponent);

