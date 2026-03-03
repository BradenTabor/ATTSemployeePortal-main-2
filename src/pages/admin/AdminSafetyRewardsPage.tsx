import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Plus, Gift, AlertTriangle, RefreshCw, Upload, X, Loader2, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { toast } from '../../lib/toast';
import {
  useAllMonthlyRewards,
  useUpsertMonthlyReward,
  useUploadRewardImage,
  useTriggerDrawing,
  DrawingConflictError,
  type MonthlyReward,
  type UpsertRewardInput,
} from '../../hooks/safetyRewards';
import { createPortal } from 'react-dom';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type RewardStatus = 'not-set' | 'active' | 'drawing-complete' | 'no-drawing';

function getRewardStatus(
  reward: MonthlyReward | undefined,
  hasDrawing: boolean,
  now: Date,
): RewardStatus {
  if (!reward) return 'not-set';
  const monthEnd = new Date(reward.year, reward.month, 0);
  const isPast = now > monthEnd;
  if (isPast && hasDrawing) return 'drawing-complete';
  if (isPast && !hasDrawing) return 'no-drawing';
  return 'active';
}

const STATUS_BADGES: Record<RewardStatus, { label: string; cls: string }> = {
  'not-set': { label: 'Not Set', cls: 'bg-white/5 text-white/40' },
  active: { label: 'Active', cls: 'bg-emerald-500/20 text-emerald-300' },
  'drawing-complete': { label: 'Drawing Complete', cls: 'bg-blue-500/20 text-blue-300' },
  'no-drawing': { label: 'No Drawing', cls: 'bg-amber-500/20 text-amber-300' },
};

function StatusBadge({ status }: { status: RewardStatus }) {
  const cfg = STATUS_BADGES[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Month Card ────────────────────────────────────────────────────────────
interface MonthCardProps {
  year: number;
  month: number;
  reward?: MonthlyReward;
  hasDrawing: boolean;
  now: Date;
  onEdit: (year: number, month: number, reward?: MonthlyReward) => void;
  onDraw: (year: number, month: number) => void;
}

function MonthCard({ year, month, reward, hasDrawing, now, onEdit, onDraw }: MonthCardProps) {
  const status = getRewardStatus(reward, hasDrawing, now);
  const isCurrent =
    now.getFullYear() === year && now.getMonth() + 1 === month;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 ${
        isCurrent ? 'border-[#f6dcb2]/30 ring-1 ring-[#f6dcb2]/10' : 'border-white/[0.06]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {MONTHS[month - 1]} {year}
          </p>
          {reward && (
            <p className="text-xs text-white/50 mt-0.5 truncate max-w-[180px]">
              {reward.grand_prize_name}
            </p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {reward?.grand_prize_image_url ? (
        <div className="w-full h-24 rounded-lg overflow-hidden bg-white/[0.03]">
          <img
            src={reward.grand_prize_image_url}
            alt={reward.grand_prize_name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-24 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center">
          <Trophy className="w-8 h-8 text-white/10" />
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {status !== 'drawing-complete' && (
          <button
            onClick={() => onEdit(year, month, reward)}
            className="flex-1 text-xs py-1.5 rounded-lg bg-[#f6dcb2]/10 text-[#f6dcb2] hover:bg-[#f6dcb2]/20 transition-colors font-medium"
          >
            {reward ? 'Edit' : 'Set Up'}
          </button>
        )}
        {status === 'drawing-complete' && (
          <button
            onClick={() => onEdit(year, month, reward)}
            className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 text-white/50 font-medium cursor-default"
            disabled
          >
            View
          </button>
        )}
        {(status === 'no-drawing' || status === 'active') && reward && (
          <button
            onClick={() => onDraw(year, month)}
            className="text-xs py-1.5 px-3 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors font-medium"
          >
            Draw
          </button>
        )}
        {status === 'drawing-complete' && (
          <button
            onClick={() => onDraw(year, month)}
            className="text-xs py-1.5 px-3 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors font-medium"
          >
            Re-draw
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Reward Edit Modal ─────────────────────────────────────────────────────
interface RewardFormData {
  grand_prize_name: string;
  grand_prize_description: string;
  grand_prize_image_url: string;
  runner_up_1_name: string;
  runner_up_1_description: string;
  runner_up_1_image_url: string;
  runner_up_2_name: string;
  runner_up_2_description: string;
  runner_up_2_image_url: string;
}

function toFormData(reward?: MonthlyReward): RewardFormData {
  return {
    grand_prize_name: reward?.grand_prize_name ?? '',
    grand_prize_description: reward?.grand_prize_description ?? '',
    grand_prize_image_url: reward?.grand_prize_image_url ?? '',
    runner_up_1_name: reward?.runner_up_1_name ?? '',
    runner_up_1_description: reward?.runner_up_1_description ?? '',
    runner_up_1_image_url: reward?.runner_up_1_image_url ?? '',
    runner_up_2_name: reward?.runner_up_2_name ?? '',
    runner_up_2_description: reward?.runner_up_2_description ?? '',
    runner_up_2_image_url: reward?.runner_up_2_image_url ?? '',
  };
}

interface EditModalProps {
  year: number;
  month: number;
  existing?: MonthlyReward;
  onClose: () => void;
}

function EditModal({ year, month, existing, onClose }: EditModalProps) {
  const [form, setForm] = useState<RewardFormData>(() => toFormData(existing));
  const [showRunnerUp1, setShowRunnerUp1] = useState(!!existing?.runner_up_1_name);
  const [showRunnerUp2, setShowRunnerUp2] = useState(!!existing?.runner_up_2_name);
  const upsertMutation = useUpsertMonthlyReward();
  const { uploadImage } = useUploadRewardImage();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string>('');

  const handleField = useCallback(
    (field: keyof RewardFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadTarget) return;

      setUploading(uploadTarget);
      try {
        const url = await uploadImage(file, year, month, uploadTarget);
        handleField(uploadTarget as keyof RewardFormData, url);
        toast.success('Image uploaded');
      } catch {
        toast.error('Failed to upload image');
      } finally {
        setUploading(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [uploadTarget, year, month, uploadImage, handleField],
  );

  const triggerUpload = useCallback((slot: string) => {
    setUploadTarget(slot);
    setTimeout(() => fileRef.current?.click(), 0);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.grand_prize_name.trim()) {
      toast.error('Grand prize name is required');
      return;
    }

    const input: UpsertRewardInput = {
      year,
      month,
      grand_prize_name: form.grand_prize_name.trim(),
      grand_prize_description: form.grand_prize_description.trim() || null,
      grand_prize_image_url: form.grand_prize_image_url || null,
      runner_up_1_name: form.runner_up_1_name.trim() || null,
      runner_up_1_description: form.runner_up_1_description.trim() || null,
      runner_up_1_image_url: form.runner_up_1_image_url || null,
      runner_up_2_name: form.runner_up_2_name.trim() || null,
      runner_up_2_description: form.runner_up_2_description.trim() || null,
      runner_up_2_image_url: form.runner_up_2_image_url || null,
    };

    if (existing?.id) {
      input.id = existing.id;
    }

    try {
      await upsertMutation.mutateAsync(input);
      toast.success('Reward saved');
      onClose();
    } catch {
      toast.error('Failed to save reward');
    }
  }, [form, year, month, existing, upsertMutation, onClose]);

  const isSaving = upsertMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-gray-900 border border-white/[0.08] rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {MONTHS[month - 1]} {year} — {existing ? 'Edit' : 'Set Up'} Reward
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Grand Prize */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-white/60 font-medium">Grand Prize Name *</span>
            <input
              type="text"
              value={form.grand_prize_name}
              onChange={(e) => handleField('grand_prize_name', e.target.value)}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40"
              placeholder="e.g. $100 Gift Card"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/60 font-medium">Description</span>
            <textarea
              value={form.grand_prize_description}
              onChange={(e) => handleField('grand_prize_description', e.target.value)}
              rows={2}
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40 resize-none"
              placeholder="Optional description"
            />
          </label>

          <div>
            <span className="text-xs text-white/60 font-medium">Prize Image</span>
            <div className="mt-1 flex items-center gap-3">
              {form.grand_prize_image_url ? (
                <img
                  src={form.grand_prize_image_url}
                  alt="Grand prize"
                  className="w-16 h-16 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white/10" />
                </div>
              )}
              <button
                onClick={() => triggerUpload('grand_prize_image_url')}
                disabled={!!uploading}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                {uploading === 'grand_prize_image_url' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Upload
              </button>
            </div>
          </div>
        </div>

        {/* Runner-up 1 */}
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          {!showRunnerUp1 ? (
            <button
              onClick={() => setShowRunnerUp1(true)}
              className="text-xs text-[#f6dcb2]/70 hover:text-[#f6dcb2] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add runner-up prize
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">Runner-up Prize 1</span>
                <button
                  onClick={() => {
                    setShowRunnerUp1(false);
                    setShowRunnerUp2(false);
                    handleField('runner_up_1_name', '');
                    handleField('runner_up_1_description', '');
                    handleField('runner_up_1_image_url', '');
                    handleField('runner_up_2_name', '');
                    handleField('runner_up_2_description', '');
                    handleField('runner_up_2_image_url', '');
                  }}
                  className="text-xs text-white/30 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                value={form.runner_up_1_name}
                onChange={(e) => handleField('runner_up_1_name', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40"
                placeholder="Prize name"
              />
              <textarea
                value={form.runner_up_1_description}
                onChange={(e) => handleField('runner_up_1_description', e.target.value)}
                rows={2}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40 resize-none"
                placeholder="Optional description"
              />
              <button
                onClick={() => triggerUpload('runner_up_1_image_url')}
                disabled={!!uploading}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                {uploading === 'runner_up_1_image_url' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {form.runner_up_1_image_url ? 'Replace Image' : 'Upload Image'}
              </button>
            </div>
          )}
        </div>

        {/* Runner-up 2 */}
        {showRunnerUp1 && (
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            {!showRunnerUp2 ? (
              <button
                onClick={() => setShowRunnerUp2(true)}
                className="text-xs text-[#f6dcb2]/70 hover:text-[#f6dcb2] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add second runner-up
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/80">Runner-up Prize 2</span>
                  <button
                    onClick={() => {
                      setShowRunnerUp2(false);
                      handleField('runner_up_2_name', '');
                      handleField('runner_up_2_description', '');
                      handleField('runner_up_2_image_url', '');
                    }}
                    className="text-xs text-white/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={form.runner_up_2_name}
                  onChange={(e) => handleField('runner_up_2_name', e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40"
                  placeholder="Prize name"
                />
                <textarea
                  value={form.runner_up_2_description}
                  onChange={(e) => handleField('runner_up_2_description', e.target.value)}
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#f6dcb2]/40 resize-none"
                  placeholder="Optional description"
                />
                <button
                  onClick={() => triggerUpload('runner_up_2_image_url')}
                  disabled={!!uploading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors flex items-center gap-1.5"
                >
                  {uploading === 'runner_up_2_image_url' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {form.runner_up_2_image_url ? 'Replace Image' : 'Upload Image'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="flex-1 text-sm py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !form.grand_prize_name.trim()}
            className="flex-1 text-sm py-2 rounded-lg bg-[#f6dcb2]/20 text-[#f6dcb2] hover:bg-[#f6dcb2]/30 transition-colors font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Reward
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Drawing Confirmation Modal ────────────────────────────────────────────
interface DrawModalProps {
  year: number;
  month: number;
  isRedraw: boolean;
  onClose: () => void;
}

function DrawModal({ year, month, isRedraw, onClose }: DrawModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const drawMutation = useTriggerDrawing();

  const handleDraw = useCallback(async () => {
    if (isRedraw && confirmText !== 'REDRAW') return;

    try {
      const result = await drawMutation.mutateAsync({
        year,
        month,
        force: isRedraw,
      });

      const winnerName =
        result.winners.grandPrize?.name ?? 'No eligible participants';
      toast.success(`Drawing complete! Grand prize: ${winnerName}`);
      onClose();
    } catch (err) {
      if (err instanceof DrawingConflictError) {
        toast.error('A drawing already exists. Use Re-draw to override.');
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Drawing failed',
        );
      }
    }
  }, [year, month, isRedraw, confirmText, drawMutation, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-gray-900 border border-white/[0.08] rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          {isRedraw ? (
            <RefreshCw className="w-5 h-5 text-amber-400" />
          ) : (
            <Trophy className="w-5 h-5 text-emerald-400" />
          )}
          <h2 className="text-lg font-bold text-white">
            {isRedraw ? 'Re-draw' : 'Run Drawing'} — {MONTHS[month - 1]} {year}
          </h2>
        </div>

        <p className="text-sm text-white/60 mb-4">
          {isRedraw
            ? 'This will replace the existing drawing results. The previous winners will be overwritten.'
            : 'This will randomly select winners from all participants. This action cannot be undone (but you can re-draw if needed).'}
        </p>

        {isRedraw && (
          <div className="mb-4">
            <label className="text-xs text-white/50 mb-1 block">
              Type <span className="font-mono text-amber-300">REDRAW</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500/40"
              placeholder="REDRAW"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDraw}
            disabled={
              drawMutation.isPending ||
              (isRedraw && confirmText !== 'REDRAW')
            }
            className={`flex-1 text-sm py-2 rounded-lg font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${
              isRedraw
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {drawMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRedraw ? 'Re-draw Winners' : 'Draw Winners'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
function AdminSafetyRewardsPage() {
  const { data: rewards, isLoading, error, refetch } = useAllMonthlyRewards();
  const now = useMemo(() => new Date(), []);

  const [editTarget, setEditTarget] = useState<{
    year: number;
    month: number;
    reward?: MonthlyReward;
  } | null>(null);
  const [drawTarget, setDrawTarget] = useState<{
    year: number;
    month: number;
    isRedraw: boolean;
  } | null>(null);

  const rewardsMap = useMemo(() => {
    const map = new Map<string, MonthlyReward>();
    for (const r of rewards ?? []) {
      map.set(`${r.year}-${r.month}`, r);
    }
    return map;
  }, [rewards]);

  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());

  const monthSlots = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      year: selectedYear,
      month: i + 1,
    }));
  }, [selectedYear]);

  const handleEdit = useCallback(
    (year: number, month: number, reward?: MonthlyReward) => {
      setEditTarget({ year, month, reward });
    },
    [],
  );

  return (
    <DashboardLayout title="Safety Rewards Management">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <img src="/assets/safety-rewards.png" alt="" className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">Safety Rewards</h1>
            <p className="text-sm text-white/50">
              Manage monthly raffle prizes and run drawings
            </p>
          </div>
        </motion.div>

        {/* Year Selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-white tabular-nums min-w-[4ch] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-white/[0.06] rounded-xl p-4 h-52 animate-pulse"
              >
                <div className="h-4 w-24 bg-white/5 rounded mb-3" />
                <div className="h-24 bg-white/[0.03] rounded-lg mb-3" />
                <div className="h-8 bg-white/5 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-medium">
                Failed to load rewards
              </p>
              <p className="text-xs text-red-300/60 mt-0.5">
                {error instanceof Error
                  ? error.message
                  : typeof error === 'object' && error !== null && 'message' in error
                    ? String((error as { message: unknown }).message)
                    : 'Unknown error'}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && rewards?.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Gift className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white/60 mb-2">
              No rewards yet
            </h3>
            <p className="text-sm text-white/40 mb-6 max-w-xs mx-auto">
              Set up your first monthly prize to get started with the safety raffle.
            </p>
            <button
              onClick={() => handleEdit(now.getFullYear(), now.getMonth() + 1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f6dcb2]/20 text-[#f6dcb2] hover:bg-[#f6dcb2]/30 transition-colors font-semibold text-sm"
            >
              <Plus className="w-4 h-4" /> Add Reward
            </button>
          </motion.div>
        )}

        {/* Month Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthSlots.map(({ year, month }) => {
              const key = `${year}-${month}`;
              const reward = rewardsMap.get(key);
              // We don't query drawings individually here; the MonthCard
              // shows "Draw" or "Re-draw" based on status. The draw modal
              // itself handles the 409 conflict if a drawing already exists.
              return (
                <MonthCard
                  key={key}
                  year={year}
                  month={month}
                  reward={reward}
                  hasDrawing={false}
                  now={now}
                  onEdit={handleEdit}
                  onDraw={(y, m) => {
                    // Try drawing; if 409, the mutation surfaces the conflict
                    setDrawTarget({ year: y, month: m, isRedraw: false });
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Quick-add next year */}
        {!isLoading && !error && selectedYear === now.getFullYear() && (
          <div className="flex justify-center">
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors text-sm"
            >
              <ChevronRight className="w-4 h-4" /> View {selectedYear + 1}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editTarget && (
          <EditModal
            key="edit"
            year={editTarget.year}
            month={editTarget.month}
            existing={editTarget.reward}
            onClose={() => setEditTarget(null)}
          />
        )}
        {drawTarget && (
          <DrawModal
            key="draw"
            year={drawTarget.year}
            month={drawTarget.month}
            isRedraw={drawTarget.isRedraw}
            onClose={() => setDrawTarget(null)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default AdminSafetyRewardsPage;
