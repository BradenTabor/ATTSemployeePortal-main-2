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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#f4c979]" />
          Milestones / Checkpoints
        </label>
        <button
          type="button"
          onClick={addMilestone}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4c979]/10 border border-[#f4c979]/30 text-[#f4c979] text-xs font-semibold hover:bg-[#f4c979]/20 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Milestone
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {milestones.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center text-sm text-white/40 border border-dashed border-white/10 rounded-2xl"
          >
            No milestones added yet. Click "Add Milestone" to create checkpoints for this job.
          </motion.div>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone, index) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative rounded-2xl border border-white/10 bg-[#050402]/60 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-3 text-white/20 cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Milestone title"
                        value={milestone.title}
                        onChange={(e) => updateMilestone(index, { title: e.target.value })}
                        disabled={disabled}
                        className="flex-1 bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                      />
                      <input
                        type="date"
                        value={milestone.target_date}
                        onChange={(e) => updateMilestone(index, { target_date: e.target.value })}
                        disabled={disabled}
                        className="w-40 bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                      />
                    </div>

                    <textarea
                      placeholder="Description (optional)"
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, { description: e.target.value })}
                      disabled={disabled}
                      rows={2}
                      className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    disabled={disabled}
                    className="mt-2 p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#f4c979]/20 border border-[#f4c979]/40 flex items-center justify-center text-[10px] font-bold text-[#f4c979]">
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

