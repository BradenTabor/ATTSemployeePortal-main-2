import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, Loader2, MapPin, Ruler, User, Wrench, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { formToast } from '../../lib/formToast';
import { cn } from '../../lib/utils';
import { getTodayDateString } from '../../lib/jobProgressUtils';
import {
  SPAN_LENGTH_PRESETS,
  type Equipment,
  type JobProgressTracker,
  type JobProgressUpdateFormData,
} from '../../types/jobs';
import { logger } from '../../lib/logger';
import { FormSuccessCelebration } from '../forms/FormSuccessCelebration';
import './JobProgressUpdateForm.css';
import { Z } from "@/lib/zIndex";

interface JobProgressUpdateFormProps {
  job: JobProgressTracker;
  onSubmit: () => void;
  onCancel: () => void;
}

// Compact emerald-themed input styling
const baseInput =
  'w-full bg-[#020d09]/80 border border-emerald-500/25 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 focus-visible:border-emerald-400/40 disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px] touch-manipulation transition-all';

const labelClass =
  'text-[10px] uppercase tracking-widest text-emerald-300/60 flex items-center gap-1.5 mb-1 font-medium';

const defaultForm: JobProgressUpdateFormData = {
  date: getTodayDateString(),
  spans_completed: 1,
  span_length_category: 'general',
  equipment: 'bucket',
  job_title: '',
  notes: '',
};

export function JobProgressUpdateForm({ job, onSubmit, onCancel }: JobProgressUpdateFormProps) {
  const { user, fullName } = useAuth();
  const [formData, setFormData] = useState<JobProgressUpdateFormData>({
    ...defaultForm,
    full_name: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [submittedSpans, setSubmittedSpans] = useState(0);
  const [submittedFeet, setSubmittedFeet] = useState(0);

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
      formToast.error('Authentication Required', 'You must be signed in to submit progress');
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
      setError('Spans completed must be > 0');
      return false;
    }
    if (!formData.job_title.trim()) {
      setError('Role is required');
      return false;
    }
    if (!job.circuit && !job.job_location) {
      setError('Circuit required on job');
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
      formToast.error('Authentication Required', 'You must be signed in to submit progress');
      setSubmitting(false);
      return;
    }

    await formToast.submitting('Saving progress update...');

    const payload = {
      job_id: job.id,
      user_id: userId,
      full_name: formData.full_name?.trim() || userFullName,
      email: userEmail,
      circuit: job.circuit || job.job_location || '',
      date: formData.date,
      spans_completed: formData.spans_completed,
      span_length_feet: spanLengthFeet,
      span_length_category: formData.span_length_category,
      equipment: formData.equipment,
      job_title: formData.job_title,
      notes: formData.notes || null,
    };

    const { error: insertError } = await supabase.from('job_progress_updates').insert(payload);

    if (insertError) {
      logger.error('Progress update error:', insertError);
      if (insertError.code === '23503') {
        formToast.error('Job Not Found', 'This job no longer exists in the system.');
      } else if (insertError.code === '42501') {
        formToast.error('Permission Denied', 'You do not have permission to update this job.');
      } else {
        formToast.error('Update Failed', insertError.message, {
          onRetry: () => handleSubmit(e),
        });
      }
      setSubmitting(false);
      return;
    }

    // Dismiss loading toast before showing celebration
    formToast.dismiss();
    
    // Store submitted values for celebration stats
    setSubmittedSpans(formData.spans_completed);
    setSubmittedFeet(totalFeet);
    
    // Show celebration
    setSubmitting(false);
    setShowCelebration(true);
  };
  
  // Handle celebration continue
  const handleCelebrationContinue = useCallback(() => {
    setShowCelebration(false);
    onSubmit();
  }, [onSubmit]);

  const equipmentOptions: { value: Equipment; label: string }[] = [
    { value: 'jerraff', label: 'Jarraff' },
    { value: 'bucket', label: 'Bucket' },
    { value: 'mulcher', label: 'Mulcher' },
  ];

  return (
    <>
      {/* Success Celebration */}
      <FormSuccessCelebration
        isVisible={showCelebration}
        formType="equipment" // Using 'equipment' for green theme
        title="Progress Saved!"
        message={`${submittedSpans} span${submittedSpans > 1 ? 's' : ''} (${submittedFeet.toLocaleString()} ft) has been recorded for ${job.job_name}.`}
        onContinue={handleCelebrationContinue}
        stats={{
          spansCount: submittedSpans,
        }}
        userName={fullName || undefined}
      />
      
      <AnimatePresence>
      {!showCelebration && (
      <motion.div style={{ zIndex: Z.modal }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-emerald-500/30',
            'shadow-2xl shadow-emerald-900/20 overflow-hidden flex flex-col',
            'max-h-[85vh] sm:max-h-[80vh]'
          )}
          style={{ background: 'linear-gradient(180deg, #04150f 0%, #041812 50%, #03120c 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-emerald-900/10">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">
                  Progress Update
                </span>
              </div>
              <h3 className="text-base font-bold text-white truncate mt-0.5">{job.job_name}</h3>
              <p className="flex items-center gap-1 text-[11px] text-white/40 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-400/70" />
                {job.circuit || job.job_location || 'No circuit'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-9 h-9 rounded-lg border border-white/10 text-white/50 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs"
                >
                  {error}
                </motion.div>
              )}

              {/* Row 1: Name & Date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>
                    <User className="w-3 h-3" /> Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name ?? userFullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Your name"
                    className={baseInput}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <Calendar className="w-3 h-3" /> Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    max={getTodayDateString()}
                    className={cn(baseInput, '[color-scheme:dark]')}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Row 2: Equipment & Role */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>
                    <Wrench className="w-3 h-3" /> Equipment
                  </label>
                  <select
                    value={formData.equipment}
                    onChange={(e) => setFormData(prev => ({ ...prev, equipment: e.target.value as Equipment }))}
                    className={cn(baseInput, 'pr-8 appearance-none cursor-pointer')}
                    disabled={submitting}
                  >
                    {equipmentOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#041812]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    <User className="w-3 h-3" /> Role
                  </label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                    placeholder="e.g., Foreman"
                    className={baseInput}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Spans Input with Inline Preset */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className={labelClass}>
                      <Ruler className="w-3 h-3" /> Spans Completed
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={formData.spans_completed}
                      onChange={(e) => setFormData(prev => ({ ...prev, spans_completed: Number(e.target.value) || 0 }))}
                      className={cn(baseInput, 'text-center text-lg font-bold py-2')}
                      disabled={submitting}
                    />
                  </div>
                  <div className="text-center px-2">
                    <span className="text-white/40 text-lg">×</span>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300/60 mb-1">Per Span</p>
                    <p className="text-xl font-bold text-emerald-400">{spanLengthFeet}</p>
                    <p className="text-[10px] text-white/40">feet</p>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-white/40 text-lg">=</span>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300/60 mb-1">Total</p>
                    <p className="text-xl font-bold text-white">{totalFeet.toLocaleString()}</p>
                    <p className="text-[10px] text-white/40">feet</p>
                  </div>
                </div>
              </div>

              {/* Optional Notes - Collapsible Style */}
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any context..."
                  className={cn(baseInput, 'resize-none min-h-[60px]')}
                  disabled={submitting}
                />
              </div>
            </div>
          </form>

          {/* Fixed Footer */}
          <div className="flex items-center gap-2 p-3 border-t border-emerald-500/20 bg-[#020d09]/80">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 px-3 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm font-medium min-h-[44px] active:bg-white/10 touch-manipulation disabled:opacity-50"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              className={cn(
                'flex-[1.5] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold min-h-[44px] touch-manipulation',
                'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-[#041812]',
                'shadow-lg shadow-emerald-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Progress
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
