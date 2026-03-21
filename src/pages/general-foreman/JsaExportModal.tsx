import { memo, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, FileText, Table2, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import {
  JSA_SECTIONS,
  type JsaSectionKey,
  type JsaExportOptions,
  BATCH_CAP,
  generateIndividualJsaPdf,
  generateBatchJsaPdf,
  exportJsaCsv,
  exportJsaExcel,
  buildJsaFilename,
  downloadBlob,
  shareOrDownload,
} from '../../lib/jsaIndividualExport';
import type { AdminJsaRow } from '../../pages/admin/admin-jsa/types';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

type ExportFormat = 'pdf' | 'csv' | 'xlsx';

interface JsaExportModalProps {
  records: AdminJsaRow[];
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{ id: ExportFormat; label: string; icon: React.ReactNode }> = [
  { id: 'pdf', label: 'PDF', icon: <FileText className="w-4 h-4" /> },
  { id: 'csv', label: 'CSV', icon: <Table2 className="w-4 h-4" /> },
  { id: 'xlsx', label: 'Excel', icon: <FileSpreadsheet className="w-4 h-4" /> },
];

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 16 },
};

const springTransition = { type: 'spring' as const, stiffness: 200, damping: 25 };

function JsaExportModalInner({ records, onClose }: JsaExportModalProps) {
  const { user } = useAuth();
  const isBatch = records.length > 1;
  const isOverCap = records.length > BATCH_CAP;
  const canShare = typeof navigator.share === 'function';

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [enabledSections, setEnabledSections] = useState<Set<JsaSectionKey>>(
    () => new Set(JSA_SECTIONS.map(s => s.key)),
  );
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = records[0];
  const exportedBy = user?.email || '';

  const toggleSection = useCallback((key: JsaSectionKey) => {
    setEnabledSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setEnabledSections(prev => {
      if (prev.size === JSA_SECTIONS.length) return new Set<JsaSectionKey>();
      return new Set(JSA_SECTIONS.map(s => s.key));
    });
  }, []);

  const options: JsaExportOptions = useMemo(
    () => ({ sections: enabledSections }),
    [enabledSections],
  );

  const handleExport = useCallback(async (share: boolean) => {
    if (isOverCap || exporting) return;
    setExporting(true);
    setError(null);

    try {
      if (selectedFormat === 'csv') {
        exportJsaCsv(records, exportedBy);
      } else if (selectedFormat === 'xlsx') {
        await exportJsaExcel(records, exportedBy);
      } else {
        const blob = isBatch
          ? await generateBatchJsaPdf(records, options, exportedBy)
          : await generateIndividualJsaPdf(record, options, exportedBy);

        const filename = buildJsaFilename('pdf', isBatch ? undefined : record, isBatch ? records.length : undefined);

        if (share) {
          await shareOrDownload(blob, filename, 'application/pdf', `JSA Report — ${record.work_location || 'Export'}`);
        } else {
          downloadBlob(blob, filename);
        }
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed. Please try again.';
      logger.error('[JsaExportModal] Export failed', err);
      setError(msg);
    } finally {
      setExporting(false);
    }
  }, [isOverCap, exporting, selectedFormat, records, exportedBy, isBatch, options, record, onClose]);

  // Preview info
  const locationPreview = isBatch
    ? records.slice(0, 3).map(r => r.work_location || 'Unknown').join(', ') + (records.length > 3 ? ` +${records.length - 3} more` : '')
    : record.work_location || 'Unknown Location';

  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="jsa-export-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        key="jsa-export-modal"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={springTransition}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export JSA"
        className="fixed z-50 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-[10vh] sm:top-[12vh] w-auto sm:w-full sm:max-w-md rounded-2xl border border-white/[0.12] shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(45, 27, 78, 0.95) 0%, rgba(15, 8, 25, 0.98) 100%)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        }}
      >
        <div className="max-h-[75vh] overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#c084fc]/80">
                  {isBatch ? `Export ${records.length} JSAs` : 'Export JSA'}
                </p>
                <p className="text-base font-bold tracking-tight text-white mt-0.5 truncate">
                  {locationPreview}
                </p>
                {!isBatch && (
                  <p className="text-xs text-[#a78bfa]/70 mt-0.5">
                    {record.job_date || '—'} &middot; {record.user_name || 'Unknown'}
                  </p>
                )}
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg border border-white/8 bg-white/[0.04] p-2 text-white/50 hover:text-white hover:bg-white/8 transition flex-shrink-0"
                aria-label="Close export modal"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Batch cap warning */}
            {isOverCap && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Select up to {BATCH_CAP} records for a single export. For larger exports, use the Admin bulk export.</span>
              </div>
            )}

            {/* Format selector */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#a78bfa]/60 font-semibold">Format</p>
              <div className="flex gap-1.5 rounded-xl bg-[#0a0513]/60 border border-[#c084fc]/20 p-1">
                {FORMAT_OPTIONS.map(opt => {
                  const isActive = selectedFormat === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedFormat(opt.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-[#a78bfa]/70 hover:text-[#e9d5ff]'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="format-indicator"
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] shadow-[0_4px_12px_rgba(192,132,252,0.3)]"
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        {opt.icon}
                        {opt.label}
                      </span>
                      {opt.id === 'pdf' && !isBatch && (
                        <span className="relative text-[8px] text-[#c084fc]/60 absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap hidden sm:block">
                          Recommended
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Section toggles (PDF only) */}
            <AnimatePresence mode="wait">
              {selectedFormat === 'pdf' && (
                <motion.div
                  key="sections"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#a78bfa]/60 font-semibold">Sections</p>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-[10px] text-[#c084fc] hover:text-[#e9d5ff] font-semibold transition-colors"
                      >
                        {enabledSections.size === JSA_SECTIONS.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {JSA_SECTIONS.map((sec, i) => {
                        const isOn = enabledSections.has(sec.key);
                        return (
                          <motion.button
                            key={sec.key}
                            type="button"
                            onClick={() => toggleSection(sec.key)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02, type: 'spring', stiffness: 300, damping: 25 }}
                            whileTap={{ scale: 0.97 }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                              isOn
                                ? 'bg-[#c084fc]/15 border border-[#c084fc]/40 text-[#e9d5ff]'
                                : 'bg-white/[0.02] border border-white/8 text-[#a78bfa]/50'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                              isOn ? 'bg-[#c084fc]' : 'bg-white/10 border border-white/20'
                            }`}>
                              {isOn && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="truncate">{sec.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {canShare && selectedFormat === 'pdf' && (
                <motion.button
                  type="button"
                  onClick={() => handleExport(true)}
                  disabled={exporting || isOverCap || (selectedFormat === 'pdf' && enabledSections.size === 0)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] text-white text-sm font-semibold shadow-[0_6px_16px_rgba(192,132,252,0.3)] transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  Share
                </motion.button>
              )}

              <motion.button
                type="button"
                onClick={() => handleExport(false)}
                disabled={exporting || isOverCap || (selectedFormat === 'pdf' && enabledSections.size === 0)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${
                  canShare && selectedFormat === 'pdf'
                    ? 'flex-1 border border-[#c084fc]/30 text-[#c084fc] hover:bg-[#c084fc]/8'
                    : 'flex-1 bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] text-white shadow-[0_6px_16px_rgba(192,132,252,0.3)]'
                }`}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

const JsaExportModal = memo(JsaExportModalInner);
export default JsaExportModal;
