/**
 * ContactTemplatePicker Component
 * 
 * A compact horizontal picker for saved emergency contact templates.
 * Allows quick-fill of all 4 contact fields from saved templates.
 * Includes ability to save current form contacts as a new template.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Star,
  Plus,
  Check,
  X,
  Loader2,
  Trash2,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUserContactTemplates, type ContactTemplate } from '../../hooks/user';
import { useModalOverlay } from '../../hooks/useModalOverlay';

// =============================================================================
// TYPES
// =============================================================================

interface ContactTemplatePicker {
  /** Current form contact values */
  currentContacts: {
    oc: string;
    doc: string;
    gf: string;
    safety: string;
  };
  /** Callback when a template is applied */
  onApply: (contacts: {
    oc: string;
    doc: string;
    gf: string;
    safety: string;
  }) => void;
  /** Optional className for styling */
  className?: string;
}

// =============================================================================
// SAVE TEMPLATE MODAL
// =============================================================================

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, makeDefault: boolean) => Promise<void>;
  isSaving: boolean;
}

function SaveTemplateModal({ isOpen, onClose, onSave, isSaving }: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 101 });

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name.trim(), makeDefault);
    setName('');
    setMakeDefault(false);
  };

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-template-modal-title"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a1a10] to-black p-5 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 id="save-template-modal-title" className="font-semibold text-white">Save Contact Template</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Crew, Night Shift"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
            </div>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-black/30 cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50"
              />
              <div>
                <p className="text-sm font-medium text-white">Set as default</p>
                <p className="text-xs text-gray-500">Auto-fill when starting new JSA</p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                name.trim() && !isSaving
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-emerald-600/30 text-white/50 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Template
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ContactTemplatePicker({
  currentContacts,
  onApply,
  className,
}: ContactTemplatePicker) {
  const {
    templates,
    isLoading,
    saveCurrentAsTemplate,
    recordUsage,
    deleteTemplate,
  } = useUserContactTemplates();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);

  // Check if current contacts have values worth saving
  const hasContactsToSave =
    currentContacts.oc.trim() ||
    currentContacts.doc.trim() ||
    currentContacts.gf.trim() ||
    currentContacts.safety.trim();

  const handleApplyTemplate = async (template: ContactTemplate) => {
    onApply({
      oc: template.oc_contact || '',
      doc: template.doc_contact || '',
      gf: template.gf_contact || '',
      safety: template.safety_contact || '',
    });
    setAppliedTemplateId(template.id);
    await recordUsage(template.id);

    // Clear applied indicator after 2 seconds
    setTimeout(() => setAppliedTemplateId(null), 2000);
  };

  const handleSaveTemplate = async (name: string, makeDefault: boolean) => {
    setIsSaving(true);
    try {
      await saveCurrentAsTemplate(
        name,
        {
          oc: currentContacts.oc,
          doc: currentContacts.doc,
          gf: currentContacts.gf,
          safety: currentContacts.safety,
        },
        makeDefault
      );
      setShowSaveModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this contact template?')) {
      await deleteTemplate(id);
    }
  };

  // Don't render if loading or no templates and no contacts to save
  if (isLoading) {
    return (
      <div className={cn("mb-4", className)}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading saved contacts...
        </div>
      </div>
    );
  }

  // Show nothing if no templates exist and no contacts to potentially save
  if (templates.length === 0 && !hasContactsToSave) {
    return null;
  }

  return (
    <div className={cn("mb-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-emerald-500/70" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Quick Fill Contacts
          </p>
        </div>
        {templates.length > 0 && (
          <button
            onClick={() => setShowManage(!showManage)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            {showManage ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {/* Template Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {templates.map((template) => (
          <motion.button
            key={template.id}
            type="button"
            onClick={() => !showManage && handleApplyTemplate(template)}
            whileTap={!showManage ? { scale: 0.95 } : undefined}
            className={cn(
              "relative flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all touch-manipulation",
              appliedTemplateId === template.id
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : template.is_default
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-black/30 text-white/70 hover:bg-white/10"
            )}
          >
            <span className="flex items-center gap-1.5">
              {template.is_default && <Star className="w-3 h-3 text-amber-400" />}
              {appliedTemplateId === template.id && <Check className="w-3 h-3" />}
              {template.name}
            </span>

            {/* Delete button (visible in manage mode) */}
            {showManage && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => handleDeleteTemplate(template.id, e)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </motion.button>
            )}
          </motion.button>
        ))}

        {/* Save Current Button */}
        {hasContactsToSave && (
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-white/50 hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            Save Current
          </button>
        )}
      </div>

      {/* Helper text */}
      {templates.length === 0 && hasContactsToSave && (
        <p className="text-[10px] text-gray-500 mt-1">
          Fill in contacts below, then save as a template for quick reuse
        </p>
      )}

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        isSaving={isSaving}
      />
    </div>
  );
}

export default ContactTemplatePicker;
