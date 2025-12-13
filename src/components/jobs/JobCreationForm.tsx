import { memo, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { isValidDateRange, getTodayDateString } from '../../lib/jobProgressUtils';
import { JobCrewSelector } from './JobCrewSelector';
import { JobMilestoneEditor } from './JobMilestoneEditor';
import type { JobFormData, MilestoneInput, CrewMember, JobProgressTracker, SpanProgressMetric } from '../../types/jobs';

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
};

function JobCreationFormComponent({
  crewMembers,
  crewLoading = false,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}: JobCreationFormProps) {
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
      };
    }
    return EMPTY_FORM;
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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

    setSubmitting(true);
    setError(null);

    const result = await onSubmit(formData);

    if (!result.success) {
      setError(result.error || 'An error occurred');
    }

    setSubmitting(false);
  };

  const inputClassName = cn(
    'w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-2xl px-4 py-3',
    'text-white placeholder:text-white/30',
    'focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  const labelClassName = 'text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-2 mb-2';

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#f4c979]" />
          {isEditing ? 'Edit Job' : 'Create New Job'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm"
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

      {/* Tracking Mode */}
      <div>
        <label className={labelClassName}>
          <Target className="w-4 h-4 text-[#f4c979]" />
          Tracking Mode *
        </label>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
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
            <span className="text-sm text-white/80">Timeline Progress (Date-based)</span>
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
            <span className="text-sm text-white/80">Job Progress (Span-based)</span>
          </label>
        </div>
        <p className="text-xs text-white/40 mt-1">
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
          className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-blue-300/80">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              <Calendar className="w-4 h-4 text-[#f4c979]" />
              Start Date *
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              min={getTodayDateString()}
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
              min={formData.start_date || getTodayDateString()}
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
          rows={3}
          className={cn(inputClassName, 'resize-none')}
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
          rows={3}
          className={cn(inputClassName, 'resize-none')}
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
          className={cn(inputClassName, 'resize-none')}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
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
  );
}

export const JobCreationForm = memo(JobCreationFormComponent);

