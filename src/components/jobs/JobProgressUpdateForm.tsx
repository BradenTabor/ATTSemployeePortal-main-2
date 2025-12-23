import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Loader2, MapPin, Ruler, Shield, User, Wrench } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';
import { getTodayDateString } from '../../lib/jobProgressUtils';
import {
  SPAN_LENGTH_PRESETS,
  type Equipment,
  type JobProgressTracker,
  type JobProgressUpdateFormData,
  type SpanLengthCategory,
} from '../../types/jobs';
import { logger } from '../../lib/logger';
import './JobProgressUpdateForm.css';

interface JobProgressUpdateFormProps {
  job: JobProgressTracker;
  onSubmit: () => void;
  onCancel: () => void;
}

const baseInput =
  'w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:shadow-[0_0_25px_4px_rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed';

const labelClass =
  'text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-2 mb-2';

const defaultForm: JobProgressUpdateFormData = {
  date: getTodayDateString(),
  spans_completed: 1,
  span_length_category: 'general',
  equipment: 'bucket',
  job_title: '',
  notes: '',
};

export function JobProgressUpdateForm({ job, onSubmit, onCancel }: JobProgressUpdateFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<JobProgressUpdateFormData>({
    ...defaultForm,
    full_name: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userFullName =
    (user?.user_metadata as Record<string, string | undefined>)?.full_name ||
    (user?.user_metadata as Record<string, string | undefined>)?.name ||
    'Unknown User';
  const userEmail = user?.email || 'unknown@atts.com';

  const spanLengthFeet = useMemo(() => {
    return SPAN_LENGTH_PRESETS[formData.span_length_category];
  }, [formData.span_length_category]);

  const totalFeet = useMemo(
    () => (spanLengthFeet > 0 ? spanLengthFeet * Math.max(0, formData.spans_completed) : 0),
    [spanLengthFeet, formData.spans_completed]
  );

  const validate = (): boolean => {
    if (!user?.id) {
      toast.error('You must be signed in to submit progress');
      return false;
    }

    if (!formData.date) {
      setError('Date is required');
      return false;
    }

    const effectiveName = formData.full_name?.trim() || userFullName;
    if (!effectiveName.trim()) {
      setError('Full name is required');
      return false;
    }

    if (!formData.spans_completed || formData.spans_completed <= 0) {
      setError('Spans completed must be greater than zero');
      return false;
    }

    if (!formData.job_title.trim()) {
      setError('Your role is required');
      return false;
    }

    if (!job.circuit && !job.job_location) {
      setError('Circuit is required on the job before submitting progress');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    const userId = user?.id;
    if (!userId) {
      toast.error('You must be signed in to submit progress');
      setSubmitting(false);
      return;
    }

    const spanLength = spanLengthFeet;
    const payload = {
      job_id: job.id,
      user_id: userId,
      full_name: formData.full_name?.trim() || userFullName,
      email: userEmail,
      circuit: job.circuit || job.job_location || '',
      date: formData.date,
      spans_completed: formData.spans_completed,
      span_length_feet: spanLength,
      span_length_category: formData.span_length_category,
      equipment: formData.equipment,
      job_title: formData.job_title,
      notes: formData.notes || null,
    };

    const { error: insertError } = await supabase.from('job_progress_updates').insert(payload);

    if (insertError) {
      logger.error('Progress update error:', insertError);
      if (insertError.code === '23503') {
        toast.error('Job no longer exists');
      } else if (insertError.code === '42501') {
        toast.error('You do not have permission to update this job');
      } else {
        toast.error(`Failed to save progress: ${insertError.message}`);
      }
      setSubmitting(false);
      return;
    }

    toast.success('Progress update saved!');
    setSubmitting(false);
    onSubmit();
  };

  const spanOptions: { value: SpanLengthCategory; label: string; hint: string }[] = [
    { value: 'general', label: 'General', hint: '300 ft per span' },
  ];

  const equipmentOptions: { value: Equipment; label: string }[] = [
    { value: 'jerraff', label: 'Jarraff' },
    { value: 'bucket', label: 'Bucket' },
    { value: 'mulcher', label: 'Mulcher' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm job-progress-overlay"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          className="w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col job-progress-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-white/10 mt-2.5 mb-2.5 job-progress-header"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Submit Progress</p>
              <h3 className="text-lg font-semibold text-white">{job.job_name}</h3>
              <div className="flex items-center gap-3 text-xs text-white/60 mt-1">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#f4c979]" />
                  {job.circuit || job.job_location || 'Circuit not set'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#f4c979]" />
                  {userFullName}
                </span>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-white/70 hover:text-white rounded-lg px-4 py-2 text-sm font-medium mr-12 border border-white/10 hover:border-white/20 transition-all duration-200 job-progress-close-btn"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto md:p-8">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  <User className="w-4 h-4 text-[#f4c979]" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name ?? userFullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className={baseInput}
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="work-date" className={labelClass}>
                  <Calendar className="w-4 h-4 text-[#f4c979]" />
                  Work Date
                </label>
                <input
                  id="work-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={getTodayDateString()}
                  className={cn(baseInput, '[color-scheme:dark]')}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="equipment-select" className={labelClass}>
                  <Shield className="w-4 h-4 text-[#f4c979]" />
                  Equipment Used
                </label>
                <select
                  id="equipment-select"
                  title="Equipment Used"
                  value={formData.equipment}
                  onChange={(e) => setFormData(prev => ({ ...prev, equipment: e.target.value as Equipment }))}
                  className={cn(baseInput, 'pr-10')}
                  disabled={submitting}
                >
                  {equipmentOptions.map(option => (
                    <option key={option.value} value={option.value} className="bg-[#0b0907]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  <Wrench className="w-4 h-4 text-[#f4c979]" />
                  Your Role
                </label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                  placeholder="e.g., Bucket Foreman"
                  className={baseInput}
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="spans-completed" className={labelClass}>
                <Ruler className="w-4 h-4 text-[#f4c979]" />
                Spans Completed
              </label>
              <input
                id="spans-completed"
                type="number"
                min={1}
                value={formData.spans_completed}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, spans_completed: Number(e.target.value) || 0 }))
                }
                className={baseInput}
                disabled={submitting}
              />
            </div>

            <div>
              <label className={labelClass}>
                <Ruler className="w-4 h-4 text-[#f4c979]" />
                Typical Span Length
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {spanOptions.map(option => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition-all',
                      formData.span_length_category === option.value
                        ? 'border-[#f4c979]/50 bg-[#f4c979]/5 span-option-selected'
                        : 'border-white/10 hover:border-[#f4c979]/30'
                    )}
                  >
                    <input
                      type="radio"
                      name="span_length_category"
                      value={option.value}
                      checked={formData.span_length_category === option.value}
                      onChange={() =>
                        setFormData(prev => ({
                          ...prev,
                          span_length_category: option.value,
                        }))
                      }
                      disabled={submitting}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm text-white font-semibold">{option.label}</p>
                      <p className="text-xs text-white/60">{option.hint}</p>
                      <p className="text-xs text-emerald-300 mt-1">Preset: {SPAN_LENGTH_PRESETS[option.value]} ft</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Any important context or blockers..."
                className={cn(baseInput, 'resize-none')}
                disabled={submitting}
              />
            </div>

            <div 
              className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 job-progress-summary"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Summary</p>
                <p className="text-sm text-white">
                  {formData.spans_completed} span(s) × {spanLengthFeet.toFixed(0)} ft
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Total Feet</p>
                <p className="text-2xl font-bold text-emerald-300">{totalFeet.toFixed(0)} ft</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 pb-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-white/80 text-sm font-semibold transition-colors disabled:opacity-50 job-progress-cancel-btn"
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
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'job-progress-submit-btn'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Save Progress
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
