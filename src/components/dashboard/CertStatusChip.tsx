/**
 * Compact cert status chip for WelcomeHeader: Certs OK | N Expiring | N Expired.
 * Uses staleTime from cert hooks; shows skeleton while loading; hides when no certs.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMyCertificationRecords } from '../../hooks/useCertifications';
import { useMyExternalCertifications } from '../../hooks/queries/useExternalCertifications';
import { calculateDaysUntilExpiration, getExternalCertDisplayStatus } from '../../lib/certStatus';

export function CertStatusChip() {
  const { user } = useAuth();
  const { data: builtInRecords, isLoading: loadingBuiltIn } = useMyCertificationRecords(user?.id);
  const { data: externalCerts, isLoading: loadingExternal } = useMyExternalCertifications();

  const isLoading = loadingBuiltIn || loadingExternal;
  const status = useMemo(() => {
    const recs = builtInRecords ?? [];
    const ext = externalCerts ?? [];
    let expiring = 0;
    let expired = 0;
    let hasAny = false;
    recs.forEach((r) => {
      if (r.status !== 'active' && r.status !== 'expired') return;
      hasAny = true;
      const days = calculateDaysUntilExpiration(r.expires_at ?? null);
      if (days !== null) {
        if (days < 0) expired++;
        else if (days <= 30) expiring++;
      }
    });
    ext.forEach((c) => {
      hasAny = true;
      const display = getExternalCertDisplayStatus(c.effective_status, c.expiration_date);
      if (display === 'expiring') expiring++;
      if (display === 'expired' || display === 'revoked') expired++;
    });
    return { expiring, expired, hasAny };
  }, [builtInRecords, externalCerts]);

  if (isLoading) {
    return (
      <span
        className="inline-block h-5 w-16 rounded-full animate-pulse bg-white/10"
        aria-hidden
      />
    );
  }

  if (!status.hasAny) return null;

  if (status.expired > 0) {
    return (
      <Link
        to="/profile"
        state={{ scrollToCertifications: true }}
        className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors"
      >
        <Award className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
        <span className="text-[8px] sm:text-[9px] font-semibold">
          {status.expired} Expired
        </span>
      </Link>
    );
  }

  if (status.expiring > 0) {
    return (
      <Link
        to="/profile"
        state={{ scrollToCertifications: true }}
        className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors"
      >
        <Award className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
        <span className="text-[8px] sm:text-[9px] font-semibold">
          {status.expiring} Expiring
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/profile"
      state={{ scrollToCertifications: true }}
      className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
    >
      <Award className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
      <span className="text-[8px] sm:text-[9px] font-semibold">Certs OK</span>
    </Link>
  );
}
