/**
 * Unified "My Certifications" section: built-in certs, external certs, driver's license.
 * Compliance ring, filter chips, expandable cert cards, empty state with CTA to Resources.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useMyCertificationRecords, useAllCertificationTypes } from '../../hooks/useCertifications';
import { useMyExternalCertifications, useExternalCertificationTypes } from '../../hooks/queries/useExternalCertifications';
import {
  calculateDaysUntilExpiration,
  formatCertDate,
  getCertStatusColor,
  getCertificationStatus,
  getExternalCertDisplayStatus,
  type CertDisplayStatus,
} from '../../lib/certStatus';
import { downloadCertificatePDF } from '../certifications/certificatePDFDownload';

const CERT_SECTION_ID = 'profile-certifications';

export interface MyCertificationsSectionProps {
  userId: string | undefined;
  /** Driver's license and class from app_users */
  driversLicenseNumber: string | null;
  driversLicenseClass: string | null;
  driversLicenseExpiration: string | null;
  fullName: string;
}

type FilterKind = 'all' | 'active' | 'expiring' | 'expired';

interface UnifiedCertItem {
  id: string;
  key: string;
  name: string;
  type: 'builtin' | 'external' | 'license';
  displayStatus: CertDisplayStatus;
  issuedDate: string | null;
  expirationDate: string | null;
  daysUntilExpiration: number | null;
  /** Built-in: verification code for PDF. External: document_url. */
  verificationCode?: string | null;
  documentUrl?: string | null;
  writtenScore?: number | null;
  recordStatus?: string;
  credentialNumber?: string | null;
  issuingAuthority?: string | null;
  category?: string;
  /** License only */
  value?: string | null;
  label?: string;
}

function ComplianceRing({
  activeCount,
  totalCount,
  hasExpiring,
  hasExpired,
}: {
  activeCount: number;
  totalCount: number;
  hasExpiring: boolean;
  hasExpired: boolean;
}) {
  const pct = totalCount > 0 ? Math.min(1, activeCount / totalCount) : 1;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference * (1 - pct);
  const strokeColor = hasExpired ? '#ef4444' : hasExpiring ? '#f59e0b' : '#10b981';
  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="relative text-center">
        {totalCount === 0 ? (
          <span className="text-[10px] sm:text-xs font-medium text-white/60">—</span>
        ) : activeCount === totalCount && !hasExpiring && !hasExpired ? (
          <span className="text-[10px] sm:text-xs font-bold text-emerald-400">All current</span>
        ) : (
          <>
            <span className="block text-sm sm:text-base font-bold text-white">{activeCount}</span>
            <span className="block text-[10px] text-white/50">/ {totalCount} active</span>
          </>
        )}
      </div>
    </div>
  );
}

export function MyCertificationsSection({
  userId,
  driversLicenseNumber,
  driversLicenseClass,
  driversLicenseExpiration,
  fullName,
}: MyCertificationsSectionProps) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: certificationRecords } = useMyCertificationRecords(userId);
  const { data: certificationTypes } = useAllCertificationTypes();
  const { data: externalCerts } = useMyExternalCertifications();
  const { data: externalTypes } = useExternalCertificationTypes();

  const { items, denominator, numerator, hasExpiring, hasExpired, isEmpty } = useMemo(() => {
    const builtInRecords = certificationRecords ?? [];
    const types = certificationTypes ?? [];
    const extCerts = externalCerts ?? [];
    const extTypesList = externalTypes ?? [];

    const requiredExternalTypes = extTypesList.filter((t) => t.is_required && t.is_active);
    const builtInTypesWithRecords = types.filter((ct) =>
      builtInRecords.some((r) => r.certification_type_id === ct.id)
    );
    const denominator =
      requiredExternalTypes.length + builtInTypesWithRecords.length;

    const list: UnifiedCertItem[] = [];
    let numerator = 0;
    let hasExpiring = false;
    let hasExpired = false;

    builtInRecords
      .filter((r) => ['active', 'expired', 'written_passed'].includes(r.status))
      .forEach((rec) => {
        const ct = types.find((t) => t.id === rec.certification_type_id);
        const name = ct?.name ?? 'Unknown';
        const days = calculateDaysUntilExpiration(rec.expires_at ?? null);
        let displayStatus: CertDisplayStatus = 'active';
        if (rec.status === 'written_passed') displayStatus = 'written_passed';
        else if (days !== null) {
          if (days < 0) {
            displayStatus = 'expired';
            hasExpired = true;
          } else if (days <= 30) {
            displayStatus = 'expiring';
            hasExpiring = true;
          }
        }
        if (displayStatus === 'active') numerator++;
        list.push({
          id: rec.id,
          key: `builtin-${rec.id}`,
          name,
          type: 'builtin',
          displayStatus,
          issuedDate: rec.certified_at,
          expirationDate: rec.expires_at ?? null,
          daysUntilExpiration: days ?? null,
          verificationCode: rec.verification_code ?? null,
          writtenScore: rec.written_score,
          recordStatus: rec.status,
        });
      });

    const requiredExtTypeIds = new Set(requiredExternalTypes.map((t) => t.id));

    extCerts.forEach((c) => {
      const displayStatus = getExternalCertDisplayStatus(c.effective_status, c.expiration_date);
      const days = calculateDaysUntilExpiration(c.expiration_date);
      if (displayStatus === 'active' && requiredExtTypeIds.has(c.external_certification_type_id)) numerator++;
      if (displayStatus === 'expiring') hasExpiring = true;
      if (displayStatus === 'expired' || displayStatus === 'revoked') hasExpired = true;
      list.push({
        id: c.id,
        key: `external-${c.id}`,
        name: c.cert_type_name ?? 'External certification',
        type: 'external',
        displayStatus,
        issuedDate: c.issued_date,
        expirationDate: c.expiration_date,
        daysUntilExpiration: days ?? null,
        documentUrl: c.document_url,
        credentialNumber: c.credential_number,
        issuingAuthority: c.issuing_authority,
        category: c.cert_type_name ? undefined : undefined,
      });
    });

    const licenseStatus = getCertificationStatus(
      driversLicenseExpiration,
      driversLicenseNumber
    );
    const licenseDays = calculateDaysUntilExpiration(driversLicenseExpiration);
    if (licenseStatus === 'expiring') hasExpiring = true;
    if (licenseStatus === 'expired') hasExpired = true;
    list.push({
      id: 'license-number',
      key: 'license-number',
      name: "Driver's License",
      label: "Driver's License",
      type: 'license',
      value: driversLicenseNumber,
      displayStatus:
        licenseStatus === 'valid'
          ? 'active'
          : licenseStatus === 'expiring'
            ? 'expiring'
            : licenseStatus === 'expired'
              ? 'expired'
              : 'missing',
      issuedDate: null,
      expirationDate: driversLicenseExpiration,
      daysUntilExpiration: licenseDays,
    });
    list.push({
      id: 'license-class',
      key: 'license-class',
      name: 'License Class',
      label: 'License Class',
      type: 'license',
      value: driversLicenseClass,
      displayStatus: driversLicenseClass ? 'active' : 'missing',
      issuedDate: null,
      expirationDate: null,
      daysUntilExpiration: null,
    });

    const certOnlyCount = list.filter((i) => i.type !== 'license').length;
    const isEmpty = certOnlyCount === 0;

    return {
      items: list,
      denominator,
      numerator: Math.min(numerator, denominator),
      hasExpiring,
      hasExpired,
      isEmpty,
    };
  }, [
    certificationRecords,
    certificationTypes,
    externalCerts,
    externalTypes,
    driversLicenseNumber,
    driversLicenseClass,
    driversLicenseExpiration,
  ]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'active')
      return items.filter((i) => i.displayStatus === 'active' || i.displayStatus === 'written_passed');
    if (filter === 'expiring') return items.filter((i) => i.displayStatus === 'expiring');
    return items.filter((i) => i.displayStatus === 'expired' || i.displayStatus === 'revoked');
  }, [items, filter]);

  const filters: { value: FilterKind; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'expiring', label: 'Expiring Soon' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <section
      id={CERT_SECTION_ID}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-emerald-400/20"
      style={{
        background:
          'linear-gradient(145deg, rgba(4, 30, 21, 0.95) 0%, rgba(2, 15, 10, 0.98) 50%, rgba(1, 8, 5, 1) 100%)',
        boxShadow:
          '0 8px 40px -10px rgba(16, 185, 129, 0.2), 0 4px 20px -8px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      <div className="relative p-3 sm:p-5 md:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
          <div
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-emerald-500/30 flex-shrink-0"
            style={{
              background:
                'linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
            }}
          >
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">My Certifications</h2>
            <p className="text-[10px] sm:text-xs text-emerald-200/50">
              {isEmpty
                ? 'View certifications & training'
                : `${filteredItems.length} certification${filteredItems.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {isEmpty ? (
          <div className="rounded-lg sm:rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-6 text-center">
            <p className="text-sm text-white/80 mb-3">No certifications yet</p>
            <a
              href="/resources"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs sm:text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              View certifications & training
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <>
            {denominator > 0 && (
              <div className="flex items-center justify-center sm:justify-start gap-4 mb-4">
                <ComplianceRing
                  activeCount={numerator}
                  totalCount={denominator}
                  hasExpiring={hasExpiring}
                  hasExpired={hasExpired}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-3 sm:mb-4">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium border transition-colors ${
                    filter === f.value
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 sm:space-y-3">
              <AnimatePresence mode="wait">
                {filteredItems.map((item) => {
                  const config = getCertStatusColor(item.displayStatus);
                  const isExpanded = expandedId === item.key;
                  return (
                    <motion.div
                      key={item.key}
                      layout
                      initial={false}
                      className={`rounded-lg sm:rounded-xl border ${config.border} ${config.bg} overflow-hidden`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === item.key ? null : item.key))
                        }
                        className="w-full p-3 sm:p-4 text-left flex items-start justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center shrink-0`}
                          >
                            {item.type === 'license' ? (
                              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                            ) : item.type === 'external' ? (
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                            ) : (
                              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-white truncate">
                              {item.name}
                            </p>
                            {(item.value != null || item.writtenScore != null) && (
                              <p className="text-[10px] sm:text-xs text-white/50">
                                {item.type === 'license'
                                  ? item.value || 'Not set'
                                  : `Score: ${item.writtenScore?.toFixed(0) ?? '—'}%`}
                              </p>
                            )}
                            {(item.expirationDate || item.issuedDate) && (
                              <p className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                {item.daysUntilExpiration != null && item.displayStatus !== 'missing'
                                  ? item.daysUntilExpiration < 0
                                    ? `Expired ${Math.abs(item.daysUntilExpiration)}d ago`
                                    : `${item.daysUntilExpiration}d left`
                                  : item.expirationDate
                                    ? formatCertDate(item.expirationDate)
                                    : item.issuedDate
                                      ? formatCertDate(item.issuedDate)
                                      : null}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`inline-flex px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-wider border ${config.badge}`}
                          >
                            {config.label}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-white/10"
                          >
                            <div className="p-3 sm:p-4 pt-2 space-y-2 text-[10px] sm:text-xs text-white/70">
                              {item.issuingAuthority && (
                                <p>
                                  <span className="text-white/50">Issuing authority:</span>{' '}
                                  {item.issuingAuthority}
                                </p>
                              )}
                              {item.credentialNumber && (
                                <p>
                                  <span className="text-white/50">Credential #:</span>{' '}
                                  {item.credentialNumber}
                                </p>
                              )}
                              {item.verificationCode && (
                                <p>
                                  <span className="text-white/50">Verification code:</span>{' '}
                                  {item.verificationCode}
                                </p>
                              )}
                              {item.issuedDate && (
                                <p>
                                  <span className="text-white/50">Issued:</span>{' '}
                                  {formatCertDate(item.issuedDate)}
                                </p>
                              )}
                              {item.expirationDate && (
                                <p>
                                  <span className="text-white/50">Expires:</span>{' '}
                                  {formatCertDate(item.expirationDate)}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 pt-2">
                                {item.type === 'builtin' && item.verificationCode && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadCertificatePDF({
                                        fullName,
                                        certificationName: item.name,
                                        certifiedAt: item.issuedDate ?? null,
                                        expiresAt: item.expirationDate ?? '',
                                        verificationCode: item.verificationCode!,
                                        verificationUrl: `${window.location.origin}/verify/${item.verificationCode}`,
                                      }).catch(() => {});
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 px-2.5 text-emerald-300 hover:bg-emerald-500/20 text-[10px] sm:text-xs font-medium"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download Certificate
                                  </button>
                                )}
                                {item.type === 'external' && item.documentUrl && (
                                  <a
                                    href={item.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 py-1.5 px-2.5 text-white/80 hover:bg-white/10 text-[10px] sm:text-xs font-medium"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View document
                                  </a>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <a
              href="/resources"
              className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-[10px] sm:text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View all certifications & training
              <ChevronRight className="w-3 h-3" />
            </a>
          </>
        )}
      </div>
    </section>
  );
}
