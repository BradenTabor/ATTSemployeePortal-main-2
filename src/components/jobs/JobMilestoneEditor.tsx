import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GripVertical, Target } from 'lucide-react';
import type { MilestoneInput } from '../../types/jobs';

interface JobMilestoneEditorProps {
  milestones: MilestoneInput[];
  onChange: (milestones: MilestoneInput[]) => void;
  disabled?: boolean;
}

function JobMilestoneEditorComponent({
  milestones,
  onChange,
  disabled = false,
}: JobMilestoneEditorProps) {
  const addMilestone = () => {
    onChange([
      ...milestones,
      { title: '', description: '', target_date: '', is_completed: false },
    ]);
  };

  const updateMilestone = (index: number, updates: Partial<MilestoneInput>) => {
    const updated = milestones.map((m, i) =>
      i === index ? { ...m, ...updates } : m
    );
    onChange(updated);
  };

  const removeMilestone = (index: number) => {
    onChange(milestones.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-[11px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-1.5 sm:gap-2">
          <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4c979]" />
          Milestones / Checkpoints
        </label>
        <button
          type="button"
          onClick={addMilestone}
          disabled={disabled}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-[#f4c979]/10 border border-[#f4c979]/30 text-[#f4c979] text-[11px] sm:text-xs font-semibold hover:bg-[#f4c979]/20 transition-colors disabled:opacity-50 min-h-[36px] sm:min-h-0"
        >
          <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          Add Milestone
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {milestones.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-5 sm:py-8 text-center text-xs sm:text-sm text-white/40 border border-dashed border-white/10 rounded-xl sm:rounded-2xl px-3"
          >
            No milestones added yet. Click "Add Milestone" to create checkpoints for this job.
          </motion.div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {milestones.map((milestone, index) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative rounded-xl sm:rounded-2xl border border-white/10 bg-[#050402]/60 p-3 sm:p-4 space-y-2 sm:space-y-3"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="mt-2 sm:mt-3 text-white/20 cursor-grab flex-shrink-0">
                    <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <input
                        type="text"
                        placeholder="Milestone title"
                        value={milestone.title}
                        onChange={(e) => updateMilestone(index, { title: e.target.value })}
                        disabled={disabled}
                        className="flex-1 min-w-0 bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-lg sm:rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-white text-xs sm:text-sm placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60"
                      />
                      <input
                        type="date"
                        value={milestone.target_date}
                        onChange={(e) => updateMilestone(index, { target_date: e.target.value })}
                        disabled={disabled}
                        className="w-full sm:w-36 min-w-0 bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-lg sm:rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-white text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 [color-scheme:dark]"
                      />
                    </div>

                    <textarea
                      placeholder="Description (optional)"
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, { description: e.target.value })}
                      disabled={disabled}
                      rows={2}
                      className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-lg sm:rounded-xl px-2.5 py-2 sm:px-3 sm:py-2 text-white text-xs sm:text-sm placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 resize-none min-h-[2.5rem]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    disabled={disabled}
                    className="mt-1 sm:mt-2 p-1.5 sm:p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                <div className="absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#f4c979]/20 border border-[#f4c979]/40 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-[#f4c979]">
                  {index + 1}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const JobMilestoneEditor = memo(JobMilestoneEditorComponent);

