/**
 * CrewManager Component
 * 
 * Main UI for managing crews in the Operations Hub.
 * Displays crew list and handles create/edit/delete operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';
import { useCrews, useCrewDetails, type Crew, type CrewFormData } from '../../hooks/useCrews';
import { useCrewMembers } from '../../hooks/jobs';
import { CrewMemberSelector } from './CrewMemberSelector';
import { toast } from '../../lib/toast';

interface CrewManagerProps {
  userId: string;
}

// Empty state
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-[#f4c979]/10 border border-[#f4c979]/20 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-[#f4c979]/50" />
      </div>
      <h3 className="text-lg font-semibold text-white/90 mb-2">No Crews Yet</h3>
      <p className="text-sm text-white/50 text-center max-w-md mb-6">
        Create named crews to organize your team members. Crews can be assigned to work sites and jobs.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm shadow-lg hover:scale-[1.02] transition-transform"
      >
        <Plus className="w-4 h-4" />
        Create First Crew
      </button>
    </motion.div>
  );
}

// Crew Form Modal
function CrewFormModal({
  crew,
  initialMemberIds = [],
  onSave,
  onClose,
  isLoading,
}: {
  crew: Crew | null;
  initialMemberIds?: string[];
  onSave: (data: CrewFormData) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEdit = !!crew;
  const { crewMembers: availableUsers, loading: usersLoading } = useCrewMembers();
  
  const [name, setName] = useState(crew?.name || '');
  const [description, setDescription] = useState(crew?.description || '');
  const [memberIds, setMemberIds] = useState<string[]>(initialMemberIds);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Crew name is required');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      member_ids: memberIds,
    });
  };

  const loading = usersLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-4 bg-black/70 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit crew' : 'Create crew'}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] shadow-2xl overflow-y-auto overflow-x-hidden my-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f6dcb2]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4c979]/15 flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-[#f4c979]" /> : <UserPlus className="w-5 h-5 text-[#f4c979]" />}
            </div>
            <div>
              <h3 className="font-semibold text-white">{isEdit ? 'Edit Crew' : 'Create Crew'}</h3>
              <p className="text-xs text-white/40">Named team for assignments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#f4c979] animate-spin" />
            </div>
          ) : (
            <>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Crew Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Crew A, North Team"
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40 resize-none"
                />
              </div>

              {/* Members */}
              <CrewMemberSelector
                availableUsers={availableUsers}
                selectedIds={memberIds}
                onChange={setMemberIds}
                loading={usersLoading}
                label="Crew Members"
              />

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {isEdit ? 'Save Changes' : 'Create Crew'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}

// Crew Card with expandable member list
function CrewCard({
  crew,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  crew: Crew;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { crew: crewDetails, loading } = useCrewDetails(expanded ? crew.id : null);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border overflow-hidden ${
        crew.is_active
          ? 'bg-gradient-to-br from-[#14110d] to-[#0b0906] border-[#f6dcb2]/20'
          : 'bg-[#0a0908] border-white/5 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              crew.is_active ? 'bg-[#f4c979]/15' : 'bg-white/5'
            }`}>
              <Users className={`w-5 h-5 ${crew.is_active ? 'text-[#f4c979]' : 'text-white/30'}`} />
            </div>
            <div>
              <h4 className="font-semibold text-white/90">{crew.name}</h4>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>{crew.member_count || 0} member{(crew.member_count || 0) !== 1 ? 's' : ''}</span>
                {crew.description && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{crew.description}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onToggleActive}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
              crew.is_active
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
            }`}
          >
            {crew.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide' : 'Show'} Members
          </button>
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#f4c979]/10 hover:bg-[#f4c979]/20 text-[#f4c979] text-xs font-medium transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
            aria-label="Delete crew"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Members */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 overflow-hidden"
          >
            <div className="p-4 bg-black/20">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-[#f4c979] animate-spin" />
                </div>
              ) : crewDetails?.members && crewDetails.members.length > 0 ? (
                <div className="space-y-2">
                  {crewDetails.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] text-xs font-bold">
                        {(member.full_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">
                          {member.full_name || member.email}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {member.email} • <span className="capitalize">{member.role}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50 text-center py-4">No members assigned</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main Component
export function CrewManager({ userId }: CrewManagerProps) {
  const {
    crews,
    loading,
    createCrew,
    updateCrew,
    deleteCrew,
    toggleCrewActive,
    setCrewMembers,
    getCrewMembers,
  } = useCrews();

  const [showModal, setShowModal] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [initialMemberIds, setInitialMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const filteredCrews = showInactive ? crews : crews.filter(c => c.is_active);

  // Lock body and dashboard scroll when crew modal is open
  useEffect(() => {
    if (!showModal) return;
    const body = document.body;
    const scrollEl = document.querySelector('[data-scroll-container]') as HTMLElement | null;
    const prevBody = body.style.overflow;
    const prevScroll = scrollEl?.style.overflow ?? '';
    body.style.overflow = 'hidden';
    if (scrollEl) scrollEl.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      if (scrollEl) scrollEl.style.overflow = prevScroll;
    };
  }, [showModal]);

  // Open edit modal with crew members loaded
  const handleEditCrew = useCallback(async (crew: Crew) => {
    setEditingCrew(crew);
    setLoadingMembers(true);
    setShowModal(true);
    
    // Load crew members
    const members = await getCrewMembers(crew.id);
    setInitialMemberIds(members.map(m => m.user_id));
    setLoadingMembers(false);
  }, [getCrewMembers]);

  // Open create modal with empty members
  const handleCreateCrew = useCallback(() => {
    setEditingCrew(null);
    setInitialMemberIds([]);
    setShowModal(true);
  }, []);

  const handleSave = useCallback(async (data: CrewFormData) => {
    setSaving(true);
    try {
      if (editingCrew) {
        // Update crew
        const result = await updateCrew(editingCrew.id, {
          name: data.name,
          description: data.description,
        });
        
        if (result.success) {
          // Update members
          await setCrewMembers(editingCrew.id, data.member_ids, userId);
          toast.success('Crew updated successfully');
          setShowModal(false);
          setEditingCrew(null);
        } else {
          toast.error(result.error || 'Failed to update crew');
        }
      } else {
        // Create crew
        const result = await createCrew(data, userId);
        if (result.success) {
          toast.success('Crew created successfully');
          setShowModal(false);
        } else {
          toast.error(result.error || 'Failed to create crew');
        }
      }
    } finally {
      setSaving(false);
    }
  }, [editingCrew, updateCrew, setCrewMembers, createCrew, userId]);

  const handleDelete = useCallback(async (crew: Crew) => {
    if (!confirm(`Are you sure you want to delete "${crew.name}"? This cannot be undone.`)) return;
    
    const result = await deleteCrew(crew.id);
    if (result.success) {
      toast.success('Crew deleted');
    } else {
      toast.error(result.error || 'Failed to delete crew');
    }
  }, [deleteCrew]);

  const handleToggleActive = useCallback(async (crew: Crew) => {
    const result = await toggleCrewActive(crew.id, !crew.is_active);
    if (result.success) {
      toast.success(crew.is_active ? 'Crew deactivated' : 'Crew activated');
    } else {
      toast.error(result.error || 'Failed to update status');
    }
  }, [toggleCrewActive]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-[#f4c979] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/30">
            <Users className="w-5 h-5 text-[#f4c979]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Crews</h3>
            <p className="text-xs text-white/50">{filteredCrews.length} crew{filteredCrews.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              showInactive
                ? 'bg-[#f4c979]/15 border-[#f4c979]/30 text-[#f4c979]'
                : 'border-white/10 text-white/50 hover:text-white/70'
            }`}
          >
            {showInactive ? 'Hide' : 'Show'} Inactive
          </button>
          <button
            onClick={handleCreateCrew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            New Crew
          </button>
        </div>
      </div>

      {/* Content */}
      {filteredCrews.length === 0 && !showInactive ? (
        <EmptyState onAdd={handleCreateCrew} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredCrews.map((crew) => (
              <CrewCard
                key={crew.id}
                crew={crew}
                onEdit={() => handleEditCrew(crew)}
                onDelete={() => handleDelete(crew)}
                onToggleActive={() => handleToggleActive(crew)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal — portaled to body and scroll locked so overlay is above layout and page doesn't scroll behind */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <CrewFormModal
              key={editingCrew?.id ?? 'new'}
              crew={editingCrew}
              initialMemberIds={initialMemberIds}
              onSave={handleSave}
              onClose={() => {
                setShowModal(false);
                setEditingCrew(null);
                setInitialMemberIds([]);
              }}
              isLoading={saving || loadingMembers}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
