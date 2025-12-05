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
  Save
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { isValidDateRange, getTodayDateString } from '../../lib/jobProgressUtils';
import { JobCrewSelector } from './JobCrewSelector';
import { JobMilestoneEditor } from './JobMilestoneEditor';
import type { JobFormData, MilestoneInput, CrewMember, JobProgressTracker } from '../../types/jobs';

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
  job_description: '',
  job_specs: '',
  start_date: '',
  end_date: '',
  notes: '',
  milestones: [],
  crew_member_ids: [],
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
        job_description: initialData.job_description || '',
        job_specs: initialData.job_specs || '',
        start_date: initialData.start_date,
        end_date: initialData.end_date,
        notes: initialData.notes || '',
        milestones: initialData.milestones?.map(m => ({
          title: m.title,
          description: m.description || '',
          target_date: m.target_date || '',
          is_completed: m.is_completed,
        })) || [],
        crew_member_ids: initialData.crew_assignments?.map(a => a.user_id) || [],
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

    if (!formData.start_date) {
      errors.start_date = 'Start date is required';
    }

    if (!formData.end_date) {
      errors.end_date = 'End date is required';
    }

    if (formData.start_date && formData.end_date && !isValidDateRange(formData.start_date, formData.end_date)) {
      errors.end_date = 'End date must be after start date';
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

      {/* Location */}
      <div>
        <label className={labelClassName}>
          <MapPin className="w-4 h-4 text-[#f4c979]" />
          Location
        </label>
        <input
          type="text"
          value={formData.job_location}
          onChange={(e) => updateField('job_location', e.target.value)}
          placeholder="Job location..."
          disabled={submitting}
          className={inputClassName}
        />
      </div>

      {/* Date Range */}
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
            className={cn(inputClassName, '[color-scheme:dark]', validationErrors.start_date && 'border-red-500/50')}
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
            className={cn(inputClassName, '[color-scheme:dark]', validationErrors.end_date && 'border-red-500/50')}
          />
          {validationErrors.end_date && (
            <p className="mt-1 text-xs text-red-400">{validationErrors.end_date}</p>
          )}
        </div>
      </div>

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

