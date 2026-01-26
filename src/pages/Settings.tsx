/**
 * User Settings Page
 * 
 * Premium green-themed settings management page featuring:
 * - Saved Contact Templates management
 * - Saved Work Locations management
 * - Digital Signature management
 * - Form Preferences (UI settings)
 * 
 * Matches the ATTS portal premium design language.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Users,
  MapPin,
  PenTool,
  Sliders,
  Plus,
  Trash2,
  Star,
  Edit3,
  Loader2,
  Sparkles,
  Save,
  RotateCcw,
  CloudSun,
  Navigation,
} from 'lucide-react';
import { toast } from '../lib/toast';
import DashboardLayout from '../layouts/DashboardLayout';
import { cn } from '../lib/utils';
import { TextEffect } from '../components/ui/TextEffect';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import {
  useUserPreferences,
  useUserContactTemplates,
  useUserSignature,
  useUserSavedLocations,
  type ContactTemplate,
} from '../hooks/user';

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const heroVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.92,
    y: 30,
    filter: 'blur(20px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      when: 'beforeChildren',
      staggerChildren: 0.12,
    },
  },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 120, damping: 14 },
  },
};

const orbVariants: Variants = {
  animate: {
    x: [0, 20, -10, 0],
    y: [0, -15, 10, 0],
    scale: [1, 1.2, 0.9, 1],
    opacity: [0.3, 0.5, 0.3, 0.3],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// SECTION CARD COMPONENT
// ============================================================================

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  badge?: string | number;
}

function SettingsSection({ title, subtitle, icon, children, action, badge }: SettingsSectionProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-emerald-400/20"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.95) 0%, rgba(2, 15, 10, 0.98) 50%, rgba(1, 8, 5, 1) 100%)',
        boxShadow: '0 8px 40px -10px rgba(16, 185, 129, 0.2), 0 4px 20px -8px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      </div>
      
      {/* Floating orbs - hidden on mobile for performance */}
      <motion.div 
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none hidden sm:block"
        variants={orbVariants}
        animate="animate"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          filter: 'blur(25px)',
        }}
      />
      
      <div className="relative p-3 sm:p-5 md:p-6">
        {/* Header - more compact on mobile */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.div 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-emerald-500/30 flex-shrink-0"
              style={{
                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {icon}
            </motion.div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-white truncate">{title}</h2>
                {badge !== undefined && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] sm:text-xs font-bold text-emerald-300 flex-shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-emerald-200/50 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
        
        {children}
      </div>
    </motion.section>
  );
}

// ============================================================================
// CONTACT TEMPLATES SECTION
// ============================================================================

function ContactTemplatesSection() {
  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
  } = useUserContactTemplates();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    oc_contact: '',
    doc_contact: '',
    gf_contact: '',
    safety_contact: '',
    is_default: false,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      oc_contact: '',
      doc_contact: '',
      gf_contact: '',
      safety_contact: '',
      is_default: false,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      if (editingId) {
        const success = await updateTemplate(editingId, formData);
        if (success) {
          toast.success('Template Updated', 'Contact template has been updated');
        } else {
          toast.error('Update Failed', 'Could not update the contact template');
        }
      } else {
        const result = await createTemplate(formData);
        if (result) {
          toast.success('Template Saved', `"${formData.name}" has been saved`);
        } else {
          toast.error('Save Failed', 'Could not save the contact template');
        }
      }
      resetForm();
    } catch {
      toast.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (template: ContactTemplate) => {
    setFormData({
      name: template.name,
      oc_contact: template.oc_contact || '',
      doc_contact: template.doc_contact || '',
      gf_contact: template.gf_contact || '',
      safety_contact: template.safety_contact || '',
      is_default: template.is_default,
    });
    setEditingId(template.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this contact template?')) {
      await deleteTemplate(id);
    }
  };

  if (isLoading) {
    return (
      <SettingsSection
        title="Contact Templates"
        subtitle="Quick-fill emergency contacts"
        icon={<Users className="w-5 h-5 text-emerald-400" />}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Contact Templates"
      subtitle="Quick-fill emergency contacts in JSA forms"
      icon={<Users className="w-5 h-5 text-emerald-400" />}
      badge={templates.length}
      action={
        !showAddForm && (
          <motion.button
            onClick={() => setShowAddForm(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-600/80 text-white text-[10px] sm:text-xs font-semibold hover:bg-emerald-500 transition-colors"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Add Template</span>
            <span className="sm:hidden">Add</span>
          </motion.button>
        )
      }
    >
      {/* Add/Edit Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 sm:mb-4 overflow-hidden"
          >
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 sm:space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template name (e.g., Morning Crew)"
                className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              
              <div className="grid gap-2 sm:gap-3 grid-cols-2">
                <input
                  type="text"
                  value={formData.oc_contact}
                  onChange={(e) => setFormData({ ...formData, oc_contact: e.target.value })}
                  placeholder="OC Contact"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <input
                  type="text"
                  value={formData.doc_contact}
                  onChange={(e) => setFormData({ ...formData, doc_contact: e.target.value })}
                  placeholder="DOC Contact"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <input
                  type="text"
                  value={formData.gf_contact}
                  onChange={(e) => setFormData({ ...formData, gf_contact: e.target.value })}
                  placeholder="GF Contact"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <input
                  type="text"
                  value={formData.safety_contact}
                  onChange={(e) => setFormData({ ...formData, safety_contact: e.target.value })}
                  placeholder="Safety Contact"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>

              <label className="flex items-center gap-2 text-[10px] sm:text-sm text-white/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-white/20 bg-black/50 text-emerald-500"
                />
                <span className="hidden sm:inline">Set as default (auto-fill when starting new JSA)</span>
                <span className="sm:hidden">Set as default</span>
              </label>

              <div className="flex gap-2 pt-1 sm:pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  aria-label="Cancel editing contact template"
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-white/10 bg-white/5 text-xs sm:text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!formData.name.trim() || isSaving}
                  aria-label={isSaving ? "Saving template" : editingId ? "Update contact template" : "Save contact template"}
                  className={cn(
                    "flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
                    formData.name.trim() && !isSaving
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "bg-emerald-600/30 text-white/50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" aria-hidden />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                      {editingId ? 'Update' : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
          <p className="text-xs sm:text-sm text-gray-400">No contact templates saved yet</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            Add a template to quickly fill contacts in JSA forms
          </p>
        </div>
      ) : (
        <motion.div className="space-y-1.5 sm:space-y-2" variants={containerVariants}>
          {templates.map((template) => (
            <motion.div
              key={template.id}
              variants={itemVariants}
              className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {template.is_default && (
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{template.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Used {template.use_count} times
                  </p>
                </div>
              </div>
              
              {/* Actions - always visible on mobile, hover on desktop */}
              <div className="flex items-center gap-0.5 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                {!template.is_default && (
                  <button
                    type="button"
                    onClick={() => setAsDefault(template.id)}
                    className="p-1 sm:p-1.5 rounded-md sm:rounded-lg hover:bg-white/10 text-gray-400 hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                    title="Set as default"
                    aria-label={`Set ${template.name} as default contact template`}
                  >
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEdit(template)}
                  className="p-1 sm:p-1.5 rounded-md sm:rounded-lg hover:bg-white/10 text-gray-400 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  title="Edit"
                  aria-label={`Edit ${template.name}`}
                >
                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id)}
                  className="p-1 sm:p-1.5 rounded-md sm:rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  title="Delete"
                  aria-label={`Delete ${template.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </SettingsSection>
  );
}

// ============================================================================
// SAVED LOCATIONS SECTION
// ============================================================================

function SavedLocationsSection() {
  const {
    locations,
    isLoading,
    saveLocation,
    deleteLocation,
  } = useUserSavedLocations();

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    nearest_hospital: '',
    nearest_clinic: '',
    circuit_number: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      nearest_hospital: '',
      nearest_clinic: '',
      circuit_number: '',
    });
    setShowAddForm(false);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.address.trim()) return;
    
    setIsSaving(true);
    try {
      const result = await saveLocation(formData);
      if (result) {
        toast.success('Location Saved', `"${formData.name}" has been saved`);
        resetForm();
      } else {
        toast.error('Save Failed', 'Could not save the location');
      }
    } catch {
      toast.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this saved location?')) {
      await deleteLocation(id);
    }
  };

  if (isLoading) {
    return (
      <SettingsSection
        title="Saved Locations"
        subtitle="Quick-select work sites"
        icon={<MapPin className="w-5 h-5 text-emerald-400" />}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Saved Locations"
      subtitle="Quick-select work sites with auto-fill"
      icon={<MapPin className="w-5 h-5 text-emerald-400" />}
      badge={locations.length}
      action={
        !showAddForm && (
          <motion.button
            onClick={() => setShowAddForm(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-600/80 text-white text-[10px] sm:text-xs font-semibold hover:bg-emerald-500 transition-colors"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Add Location</span>
            <span className="sm:hidden">Add</span>
          </motion.button>
        )
      }
    >
      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 sm:mb-4 overflow-hidden"
          >
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 sm:space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Location name (e.g., Downtown Site)"
                className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Address"
                className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              
              <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={formData.nearest_hospital}
                  onChange={(e) => setFormData({ ...formData, nearest_hospital: e.target.value })}
                  placeholder="Nearest Hospital"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <input
                  type="text"
                  value={formData.nearest_clinic}
                  onChange={(e) => setFormData({ ...formData, nearest_clinic: e.target.value })}
                  placeholder="Nearest Clinic"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <input
                  type="text"
                  value={formData.circuit_number}
                  onChange={(e) => setFormData({ ...formData, circuit_number: e.target.value })}
                  placeholder="Circuit #"
                  className="w-full rounded-md sm:rounded-lg border border-white/10 bg-black/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 col-span-2 sm:col-span-1"
                />
              </div>

              <div className="flex gap-2 pt-1 sm:pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  aria-label="Cancel editing location"
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg border border-white/10 bg-white/5 text-xs sm:text-sm text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!formData.name.trim() || !formData.address.trim() || isSaving}
                  aria-label={isSaving ? "Saving location..." : "Save location"}
                  className={cn(
                    "flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
                    formData.name.trim() && formData.address.trim() && !isSaving
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "bg-emerald-600/30 text-white/50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" aria-hidden />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locations List */}
      {locations.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
          <p className="text-xs sm:text-sm text-gray-400">No saved locations yet</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            Save work sites for quick selection in forms
          </p>
        </div>
      ) : (
        <motion.div className="space-y-1.5 sm:space-y-2" variants={containerVariants}>
          {locations.map((location) => (
            <motion.div
              key={location.id}
              variants={itemVariants}
              className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{location.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">{location.address}</p>
                </div>
              </div>
              
              {/* Delete button - always visible on mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDelete(location.id)}
                  className="p-1 sm:p-1.5 rounded-md sm:rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  title="Delete"
                  aria-label={`Delete location ${location.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </SettingsSection>
  );
}

// ============================================================================
// SIGNATURE SECTION
// ============================================================================

function SignatureSection() {
  const {
    signature,
    hasSignature,
    isLoading,
    deleteSignature,
  } = useUserSignature();

  const handleDelete = async () => {
    if (window.confirm('Delete your saved signature? You can create a new one in any JSA form.')) {
      await deleteSignature();
    }
  };

  if (isLoading) {
    return (
      <SettingsSection
        title="Saved Signature"
        subtitle="Digital signature for forms"
        icon={<PenTool className="w-5 h-5 text-emerald-400" />}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Saved Signature"
      subtitle="Quick-apply in JSA review step"
      icon={<PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
    >
      {hasSignature && signature ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase mb-2">Your Saved Signature</p>
            {signature.signature_type === 'canvas' ? (
              <img
                src={signature.signature_data}
                alt="Your signature"
                className="h-16 sm:h-20 mx-auto bg-white/5 rounded-lg p-2"
              />
            ) : (
              <p className="text-base sm:text-lg font-semibold text-white text-center">
                {signature.typed_name}
              </p>
            )}
            <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2">
              Saved {new Date(signature.updated_at).toLocaleDateString()}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete saved signature"
            className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs sm:text-sm font-medium hover:bg-red-500/20 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
            Delete Saved Signature
          </button>
        </div>
      ) : (
        <div className="text-center py-6 sm:py-8">
          <PenTool className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
          <p className="text-xs sm:text-sm text-gray-400">No signature saved</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
            Draw and save your signature in any JSA form's review step
          </p>
        </div>
      )}
    </SettingsSection>
  );
}

// ============================================================================
// PREFERENCES SECTION
// ============================================================================

function PreferencesSection() {
  const { preferences, isLoading, updatePreference, resetToDefaults } = useUserPreferences();

  const toggleItems = [
    {
      key: 'smart_defaults_expanded' as const,
      label: 'Expand Smart Suggestions',
      description: 'Automatically expand AI suggestions panel',
      icon: Sparkles,
    },
    {
      key: 'auto_detect_location' as const,
      label: 'Auto-Detect Location',
      description: 'Use GPS to suggest work location',
      icon: Navigation,
    },
    {
      key: 'auto_detect_weather' as const,
      label: 'Auto-Detect Weather',
      description: 'Pre-fill weather based on location',
      icon: CloudSun,
    },
    {
      key: 'show_completion_celebrations' as const,
      label: 'Show Celebrations',
      description: 'Celebrate when forms are completed',
      icon: Sparkles,
    },
  ];

  if (isLoading) {
    return (
      <SettingsSection
        title="Form Preferences"
        subtitle="Customize your experience"
        icon={<Sliders className="w-5 h-5 text-emerald-400" />}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Form Preferences"
      subtitle="Customize your form experience"
      icon={<Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
      action={
        <motion.button
          type="button"
          onClick={resetToDefaults}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Reset form preferences to defaults"
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-white/10 bg-white/5 text-white/70 text-[10px] sm:text-xs font-medium hover:bg-white/10 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
        >
          <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden />
          Reset
        </motion.button>
      }
    >
      <motion.div className="space-y-1.5 sm:space-y-2" variants={containerVariants}>
        {toggleItems.map((item) => (
          <motion.div
            key={item.key}
            variants={itemVariants}
            className="flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/10 bg-white/5"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md sm:rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-white truncate">{item.label}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{item.description}</p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => updatePreference(item.key, !preferences[item.key])}
              aria-label={`${preferences[item.key] ? "Disable" : "Enable"} ${item.label}`}
              className={cn(
                "relative w-10 h-6 sm:w-12 sm:h-7 rounded-full transition-colors flex-shrink-0 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
                preferences[item.key]
                  ? "bg-emerald-600"
                  : "bg-white/10"
              )}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-lg"
                animate={{ left: preferences[item.key] ? '20px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </motion.div>
        ))}
      </motion.div>
    </SettingsSection>
  );
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

export default function Settings() {
  const capsData = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !capsData.prefersReducedMotion && !capsData.isLowEnd;

  return (
    <DashboardLayout title="Settings">
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pb-6 pt-3 sm:pt-6">
        {/* Compact Hero Header */}
        <motion.div
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          className="mb-4 sm:mb-8"
        >
          <div 
            className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/[0.08] p-4 sm:p-6 md:p-8"
            style={{
              background: 'linear-gradient(145deg, rgba(4, 35, 24, 0.7) 0%, rgba(2, 20, 14, 0.6) 50%, rgba(1, 10, 7, 0.5) 100%)',
              backdropFilter: 'blur(24px) saturate(180%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.1)',
            }}
          >
            {/* Background orbs - hidden on mobile for performance */}
            <motion.div
              className="absolute -top-20 -left-20 w-60 h-60 rounded-full pointer-events-none hidden sm:block"
              variants={orbVariants}
              animate="animate"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            
            <div className="relative flex items-center gap-3 sm:gap-4">
              <motion.div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-500/30 flex-shrink-0"
                style={{
                  background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
                }}
                whileHover={{ scale: 1.1, rotate: 10 }}
              >
                <SettingsIcon className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-400" />
              </motion.div>
              
              <div className="min-w-0">
                {enableAnimations ? (
                  <TextEffect
                    as="h1"
                    preset="blurSlide"
                    per="char"
                    delay={0.1}
                    className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight"
                    segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent"
                  >
                    Settings
                  </TextEffect>
                ) : (
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent">
                    Settings
                  </h1>
                )}
                <p className="text-xs sm:text-sm text-emerald-200/50 mt-0.5 sm:mt-1 hidden sm:block">
                  Manage your saved data and preferences
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Sections - 2 column grid on larger screens */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 sm:space-y-6"
        >
          {/* Main content in responsive grid */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <ContactTemplatesSection />
            <SavedLocationsSection />
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <SignatureSection />
            <PreferencesSection />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
