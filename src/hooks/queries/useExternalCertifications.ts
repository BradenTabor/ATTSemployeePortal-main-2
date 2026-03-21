import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { deriveEffectiveStatus } from '../../lib/certStatus';
import { useAuth } from '../../contexts/AuthContext';
import type {
  ExternalCertificationType,
  ExternalCertCategory,
  ExternalCertStatus,
  WorkerExternalCertification,
} from '../../types/externalCertification';

// ---------------------------------------------------------------------------
// Certification Types
// ---------------------------------------------------------------------------

export function useExternalCertificationTypes() {
  return useQuery({
    queryKey: queryKeys.externalCertifications.types(),
    queryFn: async (): Promise<ExternalCertificationType[]> => {
      const { data, error } = await supabase
        .from('external_certification_types')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message ?? 'Failed to load external certification types.');
      return (data ?? []) as ExternalCertificationType[];
    },
  });
}

export function useCreateExternalCertificationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      slug: string;
      description?: string;
      category: ExternalCertCategory;
      is_required?: boolean;
      validity_months?: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('external_certification_types')
        .insert({
          name: params.name,
          slug: params.slug,
          description: params.description ?? null,
          category: params.category,
          is_required: params.is_required ?? false,
          validity_months: params.validity_months ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw new Error(error.message ?? 'Failed to create certification type.');

      await supabase.rpc('insert_certification_audit_log', {
        p_actor_id: user.id,
        p_action: 'external_cert_type_created',
        p_record_id: data.id,
        p_old_value: null,
        p_new_value: { name: params.name, category: params.category },
      }).then(() => {}, () => {});

      return data as ExternalCertificationType;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.externalCertifications.all });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

export function useUpdateExternalCertificationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Pick<ExternalCertificationType, 'name' | 'description' | 'category' | 'is_required' | 'validity_months' | 'is_active'>>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('external_certification_types')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw new Error(error.message ?? 'Failed to update certification type.');

      await supabase.rpc('insert_certification_audit_log', {
        p_actor_id: user.id,
        p_action: 'external_cert_type_updated',
        p_record_id: params.id,
        p_old_value: null,
        p_new_value: params.updates,
      }).then(() => {}, () => {});

      return data as ExternalCertificationType;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.externalCertifications.all });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

// ---------------------------------------------------------------------------
// Worker External Certifications
// ---------------------------------------------------------------------------

/**
 * Fetch external certs. When called with no userId, returns all active/pending
 * certs across all workers (for the bulk badge-count map). When called with a
 * userId, returns that worker's full history (all statuses).
 *
 * NOTE: The no-userId bulk query returns full rows. At current workforce scale
 * this is fine, but if the table grows to hundreds of workers with many certs
 * each, add a dedicated useExternalCertBadgeCounts() hook that runs
 * SELECT user_id, count(*) ... GROUP BY user_id returning only counts.
 */
export function useWorkerExternalCertifications(userId?: string, options?: { enabled?: boolean }) {
  const key = userId
    ? queryKeys.externalCertifications.byWorker(userId)
    : queryKeys.externalCertifications.allWorkers();

  const TEN_MIN = 10 * 60 * 1000;
  return useQuery({
    queryKey: key,
    staleTime: TEN_MIN,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<WorkerExternalCertification[]> => {
      let q = supabase
        .from('worker_external_certifications')
        .select('*, cert_type:external_certification_types(name), worker:app_users!user_id(full_name)');

      if (userId) {
        q = q.eq('user_id', userId);
      } else {
        q = q.in('status', ['active', 'pending_verification']);
      }

      const { data, error } = await q.order('granted_at', { ascending: false });
      if (error) throw new Error(error.message ?? 'Failed to load external certifications.');

      return (data ?? []).map((r: Record<string, unknown>) => {
        const certType = r.cert_type as { name: string } | null;
        const worker = r.worker as { full_name: string | null } | null;
        return {
          id: r.id as string,
          user_id: r.user_id as string,
          external_certification_type_id: r.external_certification_type_id as string,
          status: r.status as ExternalCertStatus,
          effective_status: deriveEffectiveStatus({
            status: r.status as string,
            expiration_date: r.expiration_date as string | null,
          }),
          issued_date: (r.issued_date as string) ?? null,
          expiration_date: (r.expiration_date as string) ?? null,
          issuing_authority: (r.issuing_authority as string) ?? null,
          credential_number: (r.credential_number as string) ?? null,
          document_url: (r.document_url as string) ?? null,
          notes: (r.notes as string) ?? null,
          verified_by: (r.verified_by as string) ?? null,
          verified_at: (r.verified_at as string) ?? null,
          granted_by: (r.granted_by as string) ?? null,
          granted_at: r.granted_at as string,
          cert_type_name: certType?.name,
          worker_name: worker?.full_name ?? undefined,
        };
      });
    },
  });
}

/**
 * Convenience wrapper: current user's external certs (no userId prop).
 * Use on Profile and dashboard so callers don't pass auth user id.
 */
export function useMyExternalCertifications() {
  const { user } = useAuth();
  return useWorkerExternalCertifications(user?.id, { enabled: !!user?.id });
}

export function useAssignExternalCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      externalCertificationTypeId: string;
      issuedDate?: string;
      expirationDate?: string;
      issuingAuthority?: string;
      credentialNumber?: string;
      documentUrl?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('worker_external_certifications')
        .insert({
          user_id: params.userId,
          external_certification_type_id: params.externalCertificationTypeId,
          status: 'active',
          issued_date: params.issuedDate ?? null,
          expiration_date: params.expirationDate ?? null,
          issuing_authority: params.issuingAuthority ?? null,
          credential_number: params.credentialNumber ?? null,
          document_url: params.documentUrl ?? null,
          notes: params.notes ?? null,
          granted_by: user.id,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new Error(error.message ?? 'Failed to assign certification.');

      await supabase.rpc('insert_certification_audit_log', {
        p_actor_id: user.id,
        p_action: 'external_cert_assigned',
        p_record_id: data.id,
        p_old_value: null,
        p_new_value: {
          user_id: params.userId,
          cert_type_id: params.externalCertificationTypeId,
        },
      }).then(() => {}, () => {});

      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalCertifications.all });
      qc.invalidateQueries({
        queryKey: queryKeys.externalCertifications.byWorker(variables.userId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

export function useUpdateExternalCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      userId: string;
      updates: {
        issued_date?: string | null;
        expiration_date?: string | null;
        issuing_authority?: string | null;
        credential_number?: string | null;
        document_url?: string | null;
        notes?: string | null;
      };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('worker_external_certifications')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw new Error(error.message ?? 'Failed to update certification.');

      await supabase.rpc('insert_certification_audit_log', {
        p_actor_id: user.id,
        p_action: 'external_cert_updated',
        p_record_id: params.id,
        p_old_value: null,
        p_new_value: params.updates,
      }).then(() => {}, () => {});

      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalCertifications.all });
      qc.invalidateQueries({
        queryKey: queryKeys.externalCertifications.byWorker(variables.userId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

export function useRevokeExternalCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      userId: string;
      reason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('worker_external_certifications')
        .update({
          status: 'revoked',
          revoked_by: user.id,
          revoked_at: new Date().toISOString(),
          revoked_reason: params.reason ?? null,
        })
        .eq('id', params.id);
      if (error) throw new Error(error.message ?? 'Failed to revoke certification.');

      await supabase.rpc('insert_certification_audit_log', {
        p_actor_id: user.id,
        p_action: 'external_cert_revoked',
        p_record_id: params.id,
        p_old_value: null,
        p_new_value: { reason: params.reason ?? null },
      }).then(() => {}, () => {});
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalCertifications.all });
      qc.invalidateQueries({
        queryKey: queryKeys.externalCertifications.byWorker(variables.userId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

// ---------------------------------------------------------------------------
// Document Upload
// ---------------------------------------------------------------------------

export function useUploadCertDocument() {
  return useMutation({
    mutationFn: async (params: {
      workerUserId: string;
      certId: string;
      file: File;
    }): Promise<string> => {
      const ext = params.file.name.split('.').pop() ?? 'bin';
      const path = `${params.workerUserId}/${params.certId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('cert-documents')
        .upload(path, params.file, { upsert: true });
      if (error) throw new Error(error.message ?? 'Failed to upload document.');

      const { data } = supabase.storage
        .from('cert-documents')
        .getPublicUrl(path);

      return data.publicUrl;
    },
  });
}
