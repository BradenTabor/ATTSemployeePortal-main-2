/**
 * CorrectiveActionForm - Modal form for creating/editing corrective actions (CAPA)
 * Rendered via createPortal to document.body so the overlay is above the layout scroll container.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateCorrectiveAction, useUpdateCorrectiveActionStatus, useVerifyCorrectiveAction } from '../../hooks/queries/useCorrectiveActions';
import { useUsersQuery } from '../../hooks/queries/useUsersQuery';
import type { CorrectiveAction, ActionType, ActionStatus } from '../../types/correctiveAction';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';
import { Z } from "@/lib/zIndex";

const ACTION_TYPES: ActionType[] = ['immediate', 'short_term', 'long_term', 'systemic'];
interface CorrectiveActionFormProps {
  incidentId?: string | null;
  action?: CorrectiveAction | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CorrectiveActionForm({ incidentId, action, onClose, onSuccess }: CorrectiveActionFormProps) {
  const { user } = useAuth();
  const { data: users } = useUsersQuery();
  const create = useCreateCorrectiveAction();
  const updateStatus = useUpdateCorrectiveActionStatus();
  const verify = useVerifyCorrectiveAction();

  const [description, setDescription] = useState(action?.description ?? '');
  const [actionType, setActionType] = useState<ActionType>(action?.action_type ?? 'short_term');
  const [assignedTo, setAssignedTo] = useState<string>(action?.assigned_to ?? '');
  const [dueDate, setDueDate] = useState(action?.due_date ?? '');
  const [completionNotes, setCompletionNotes] = useState(action?.completion_notes ?? '');
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const [prevActionId, setPrevActionId] = useState(action?.id);
  if (action?.id !== prevActionId) {
    setPrevActionId(action?.id);
    setDescription(action?.description ?? '');
    setActionType(action?.action_type ?? 'short_term');
    setAssignedTo(action?.assigned_to ?? '');
    setDueDate(action?.due_date ?? '');
    setCompletionNotes(action?.completion_notes ?? '');
  }

  const isEditing = !!action;
  const pending = create.isPending || updateStatus.isPending || verify.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!description.trim() || !dueDate) {
      toast.error('Description and due date are required');
      return;
    }

    try {
      if (isEditing) {
        await updateStatus.mutateAsync({
          id: action.id,
          status: 'completed',
          completion_notes: completionNotes || null,
        });
        toast.success('Action updated');
      } else {
        await create.mutateAsync({
          incident_id: incidentId ?? null,
          description: description.trim(),
          action_type: actionType,
          assigned_to: assignedTo || null,
          assigned_by: user.id,
          due_date: dueDate,
          completion_notes: completionNotes || null,
        });
        toast.success('Corrective action created');
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleStatusChange = async (status: ActionStatus) => {
    if (!action) return;
    try {
      await updateStatus.mutateAsync({
        id: action.id,
        status,
        completion_notes: status === 'completed' ? completionNotes || null : undefined,
      });
      toast.success('Status updated');
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleVerify = async () => {
    if (!action || !user?.id) return;
    try {
      await verify.mutateAsync({
        id: action.id,
        verified_by: user.id,
        verification_notes: verificationNotes || null,
      });
      toast.success('Action verified');
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to verify');
    }
  };

  const content = (
    <div style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capa-form-title"
    >
      <div
        className={cn(
          'w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-4 shadow-xl max-h-[90vh] overflow-y-auto'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="capa-form-title" className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Corrective Action' : 'New Corrective Action'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm min-h-[80px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              disabled={isEditing && action.status === 'verified'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Action Type</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              disabled={isEditing && action.status === 'verified'}
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t} className="bg-gray-900">
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Assign To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              disabled={isEditing && action.status === 'verified'}
            >
              <option value="" className="bg-gray-900">— Unassigned —</option>
              {users?.map((u) => (
                <option key={u.user_id} value={u.user_id} className="bg-gray-900">
                  {u.full_name ?? u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              disabled={isEditing && action.status === 'verified'}
            />
          </div>

          {isEditing && (action.status === 'completed' || action.status === 'in_progress') && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Completion Notes</label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
            </div>
          )}

          {isEditing && action.status === 'completed' && !action.verified_at && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Verification Notes</label>
              <textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for verification"
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!isEditing && (
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            )}
            {isEditing && action.status === 'open' && (
              <button
                type="button"
                onClick={() => handleStatusChange('in_progress')}
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
              >
                Start
              </button>
            )}
            {isEditing && action.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                Mark Completed
              </button>
            )}
            {isEditing && action.status === 'completed' && !action.verified_at && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                Verify
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {isEditing && (action.status === 'verified' || action.status === 'overdue') ? 'Close' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
