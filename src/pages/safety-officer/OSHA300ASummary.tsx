/**
 * OSHA 300A Annual Summary page.
 * Year selector, summary from RPC, certify modal, PDF/CSV export.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileDown, FileSpreadsheet, Check, Loader2, FileX2 } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { glass } from '../../lib/glass';
import { useOSHA300ASummary, useCertify300A, use300ACertification } from '../../hooks/queries/useOSHA300A';
import { SignaturePad } from '../../components/forms/SignaturePad';
import { format } from 'date-fns';
import { logger } from '../../lib/logger';
import { toZonedTime } from 'date-fns-tz';
import { exportOsha300Csv, exportOSHA300AITA, exportOSHA300ITA } from '../../lib/osha300Export';
import type { OSHA300ASummary as SummaryType } from '../../types/osha300a';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 - i);

const INPUT_CLASS =
  'w-full min-h-[44px] px-3 py-2 rounded-xl bg-gray-800 border border-white/10 text-white text-base font-mono tabular-nums ' +
  'placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150';

const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-stone-800 border border-white/10 text-white/90 text-sm font-medium ' +
  'hover:bg-stone-700 hover:border-white/20 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-all duration-150';

function generate300APdf(summary: SummaryType, certifiedBy: string, certifiedTitle: string, certifiedAt: string) {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    let y = 40;
    doc.setFontSize(16);
    doc.text('OSHA 300A - Summary of Work-Related Injuries and Illnesses', 40, y);
    y += 24;
    doc.setFontSize(12);
    doc.text(`Establishment Year: ${summary.year}`, 40, y);
    y += 20;
    doc.setFontSize(10);
    const rows = [
      ['Total number of cases', String(summary.total_recordable_cases)],
      ['Cases with days away from work', String(summary.cases_days_away)],
      ['Cases with job transfer or restriction', String(summary.cases_job_transfer)],
      ['Other recordable cases', String(summary.other_recordable)],
      ['Total days away from work', String(summary.total_days_away)],
      ['Total days of job transfer or restriction', String(summary.total_days_restricted)],
      ['Injury total', String(summary.total_injuries)],
      ['Illness total', String(summary.total_illnesses)],
      ['Death', String(summary.death_count)],
    ];
    rows.forEach(([label, val]) => {
      doc.text(`${label}:`, 40, y);
      doc.text(val, 280, y);
      y += 16;
    });
    if (summary.total_employees_avg != null) {
      doc.text(`Average number of employees: ${summary.total_employees_avg}`, 40, y);
      y += 16;
    }
    if (summary.total_hours_worked != null) {
      doc.text(`Total hours worked by all employees: ${summary.total_hours_worked}`, 40, y);
      y += 24;
    }
    doc.text(`Certified by: ${certifiedBy}, ${certifiedTitle}`, 40, y);
    y += 16;
    doc.text(`Date: ${certifiedAt}`, 40, y);
    doc.save(`OSHA-300A-Summary-${summary.year}.pdf`);
  });
}

export default function OSHA300ASummaryPage() {
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [totalEmployees, setTotalEmployees] = useState<string>('');
  const [totalHours, setTotalHours] = useState<string>('');
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [certName, setCertName] = useState('');
  const [certTitle, setCertTitle] = useState('');
  const [certDate, setCertDate] = useState(format(toZonedTime(new Date(), 'America/Chicago'), 'yyyy-MM-dd'));
  const [signaturePath, setSignaturePath] = useState('');
  const [certifyConfirmed, setCertifyConfirmed] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useOSHA300ASummary(year);
  const { data: certification, isLoading: certLoading } = use300ACertification(year);
  const certifyMutation = useCertify300A();

  const summaryWithManual = useMemo(() => {
    if (!summary) return null;
    const emp = totalEmployees ? parseFloat(totalEmployees) : null;
    const hrs = totalHours ? parseFloat(totalHours) : null;
    return {
      ...summary,
      total_employees_avg: emp ?? summary.total_employees_avg,
      total_hours_worked: hrs ?? summary.total_hours_worked,
    };
  }, [summary, totalEmployees, totalHours]);

  const handleCertify = async () => {
    if (!summaryWithManual || !certName.trim() || !certTitle.trim() || !signaturePath || !certifyConfirmed) return;
    try {
      await certifyMutation.mutateAsync({
        year,
        certified_by_name: certName.trim(),
        certified_by_title: certTitle.trim(),
        certified_at: new Date(certDate).toISOString(),
        signature: signaturePath,
        total_employees_avg: totalEmployees ? parseFloat(totalEmployees) : null,
        total_hours_worked: totalHours ? parseFloat(totalHours) : null,
        summary_data: summaryWithManual,
      });
      setShowCertifyModal(false);
      setCertName('');
      setCertTitle('');
      setSignaturePath('');
      setCertifyConfirmed(false);
    } catch (e) {
      logger.error('[OSHA300ASummary] Certify failed', e);
    }
  };

  const handlePdfExport = () => {
    if (!summaryWithManual || !certification) return;
    generate300APdf(
      summaryWithManual,
      certification.certified_by_name,
      certification.certified_by_title,
      format(new Date(certification.certified_at), 'yyyy-MM-dd')
    );
  };

  const handleCsvExport = async () => {
    await exportOsha300Csv();
  };

  const canCertify = certification == null && summaryWithManual && certName.trim() && certTitle.trim() && signaturePath && certifyConfirmed;

  const closeCertifyModal = useCallback(() => setShowCertifyModal(false), []);

  useEffect(() => {
    if (!showCertifyModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCertifyModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCertifyModal, closeCertifyModal]);

  return (
    <DashboardLayout title="OSHA 300A Annual Summary" pageHeading>
      <div className="max-w-3xl mx-auto pb-20">
        <Link
          to="/safety-officer-dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden />
          Back to Safety Officer Dashboard
        </Link>

        <p className="text-xs font-medium text-rose-200/60 uppercase tracking-widest mb-1" aria-hidden>
          Annual summary
        </p>
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">OSHA 300A Annual Summary</h1>
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          Summary of work-related injuries and illnesses. 300A must be posted Feb 1–Apr 30 each year.
        </p>

        {/* Year selector */}
        <div className={`${glass.card} p-4 mb-6`}>
          <label htmlFor="osha-300a-year" className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Reporting year
          </label>
          <select
            id="osha-300a-year"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="w-full max-w-[180px] min-h-[44px] px-3 py-2 rounded-xl bg-gray-800 border border-white/10 text-white text-base font-mono tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-colors duration-150"
            aria-describedby="year-desc"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <p id="year-desc" className="text-xs text-white/40 mt-1.5">Prior calendar year for the summary.</p>
        </div>

        {summaryLoading || certLoading ? (
          <div
            className="flex flex-col items-center justify-center gap-3 min-h-[200px] text-white/60"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="w-8 h-8 animate-spin text-rose-400" aria-hidden />
            <span className="text-sm">Loading summary…</span>
          </div>
        ) : summaryWithManual ? (
          <div className="space-y-6">
            {/* Summary data card */}
            <div className={glass.card}>
              <h2 className="text-xs font-medium text-rose-200/60 uppercase tracking-widest mb-2 px-4 pt-3">Summary (from incident data)</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 text-sm">
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Total recordable cases</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.total_recordable_cases}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Cases with days away</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.cases_days_away}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Cases with job transfer</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.cases_job_transfer}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Other recordable</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.other_recordable}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Total days away</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.total_days_away}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Total days restricted</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.total_days_restricted}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Injuries</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.total_injuries}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 border-b border-white/[0.04]"><dt className="text-white/60 text-xs">Illnesses</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.total_illnesses}</dd></div>
                <div className="flex items-baseline justify-between px-4 py-2 sm:col-span-2"><dt className="text-white/60 text-xs">Deaths</dt><dd className="text-white font-medium font-mono tabular-nums">{summaryWithManual.death_count}</dd></div>
              </dl>
            </div>

            {/* Manual entry: employees & hours */}
            <div className={glass.card}>
              <h2 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">Optional (for certification)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="total-employees" className="block text-sm font-medium text-white/80 mb-2">Total employees (average)</label>
                  <input
                    id="total-employees"
                    type="number"
                    min="0"
                    value={totalEmployees}
                    onChange={(e) => setTotalEmployees(e.target.value)}
                    placeholder="Manual entry"
                    disabled={!!certification}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="total-hours" className="block text-sm font-medium text-white/80 mb-2">Total hours worked</label>
                  <input
                    id="total-hours"
                    type="number"
                    min="0"
                    value={totalHours}
                    onChange={(e) => setTotalHours(e.target.value)}
                    placeholder="Manual entry"
                    disabled={!!certification}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>

            {certification ? (
              <div className={glass.success}>
                <div className="flex items-center gap-2 text-green-300 mb-2">
                  <Check className="w-5 h-5 flex-shrink-0" aria-hidden />
                  <span className="font-semibold text-white">Certified</span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">
                  Certified by {certification.certified_by_name}, {certification.certified_by_title} on{' '}
                  {format(new Date(certification.certified_at), 'MMM d, yyyy')}.
                  {certification.posted_date && (
                    <> Posted on {format(new Date(certification.posted_date), 'MMM d, yyyy')}.</>
                  )}
                </p>
                <p className="text-xs text-white/60 mt-2">Exports</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  <button type="button" onClick={handlePdfExport} className={BTN_SECONDARY}>
                    <FileDown className="w-4 h-4" aria-hidden />
                    Export PDF
                  </button>
                  <button type="button" onClick={() => summaryWithManual && exportOSHA300AITA(year, summaryWithManual)} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300A ITA CSV
                  </button>
                  <button type="button" onClick={() => exportOSHA300ITA(undefined, year)} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300/301 ITA CSV
                  </button>
                  <button type="button" onClick={handleCsvExport} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300 Log CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowCertifyModal(true)}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-green-600/20 border border-green-500/40 text-green-200 font-medium hover:bg-green-600/30 hover:border-green-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-colors duration-150"
                >
                  <Check className="w-5 h-5" aria-hidden />
                  Certify 300A
                </button>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => summaryWithManual && exportOSHA300AITA(year, summaryWithManual)} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300A ITA CSV
                  </button>
                  <button type="button" onClick={() => exportOSHA300ITA(undefined, year)} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300/301 ITA CSV
                  </button>
                  <button type="button" onClick={handleCsvExport} className={BTN_SECONDARY}>
                    <FileSpreadsheet className="w-4 h-4" aria-hidden />
                    300 Log CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`${glass.card} flex flex-col items-center justify-center py-12 px-4 text-center`} role="status">
            <FileX2 className="w-10 h-10 text-white/40 mb-3" aria-hidden />
            <p className="text-sm font-medium text-white/80">No data for selected year</p>
            <p className="text-xs text-white/50 mt-1 max-w-sm">There are no recordable incidents for this reporting year. Choose another year or add incident data to generate a summary.</p>
          </div>
        )}

        {showCertifyModal &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
              role="dialog"
              aria-modal="true"
              aria-labelledby="certify-modal-title"
              onClick={(e) => e.target === e.currentTarget && closeCertifyModal()}
            >
              <div
                className={`w-full max-w-md ${glass.elevated} p-6 max-h-[90vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="certify-modal-title" className="text-lg font-semibold text-white mb-4">Certify OSHA 300A</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="cert-name" className="block text-sm font-medium text-white/80 mb-1">Executive name</label>
                    <input
                      id="cert-name"
                      type="text"
                      value={certName}
                      onChange={(e) => setCertName(e.target.value)}
                      placeholder="Full name"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="cert-title" className="block text-sm font-medium text-white/80 mb-1">Title</label>
                    <input
                      id="cert-title"
                      type="text"
                      value={certTitle}
                      onChange={(e) => setCertTitle(e.target.value)}
                      placeholder="e.g., Company Executive"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="cert-date" className="block text-sm font-medium text-white/80 mb-1">Certification date</label>
                    <input
                      id="cert-date"
                      type="date"
                      value={certDate}
                      onChange={(e) => setCertDate(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <SignaturePad
                      value={signaturePath}
                      onChange={setSignaturePath}
                      formType="jsa"
                      required
                    />
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={certifyConfirmed}
                      onChange={(e) => setCertifyConfirmed(e.target.checked)}
                      className="mt-1 rounded border-white/20 bg-gray-800 text-green-500 focus-visible:ring-2 focus-visible:ring-green-400/50"
                    />
                    <span className="text-sm text-white/80 leading-relaxed">
                      I certify that I have examined the OSHA 300 Log and that to the best of my knowledge the annual summary is correct and complete.
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeCertifyModal}
                    className={`flex-1 min-h-[44px] rounded-xl font-medium ${BTN_SECONDARY}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCertify}
                    disabled={!canCertify || certifyMutation.isPending}
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-green-600/20 border border-green-500/40 text-green-200 font-medium hover:bg-green-600/30 hover:border-green-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors duration-150"
                  >
                    {certifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                    Certify
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </DashboardLayout>
  );
}
