/**
 * Public certificate verification by code (no auth).
 * Replaces inline useQuery + supabase.rpc in CertificateVerification page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface CertificateVerificationRow {
  full_name: string | null;
  certification_name: string;
  certified_at: string | null;
  expires_at: string;
  status: string;
}

export function useCertificateByVerificationCode(code: string | undefined) {
  return useQuery({
    queryKey: queryKeys.certifications.verification(code ?? ''),
    queryFn: async (): Promise<CertificateVerificationRow | null> => {
      if (!code?.trim()) return null;
      const { data, error } = await supabase.rpc('get_certificate_by_verification_code', {
        p_code: code.trim(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? (row as CertificateVerificationRow) : null;
    },
    enabled: !!code?.trim(),
    staleTime: 60 * 1000,
  });
}
