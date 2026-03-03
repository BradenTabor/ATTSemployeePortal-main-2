import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ElectricalQualificationLevel, WorkerQualification } from '../../types/electricalQualification';

export function useWorkerQualifications(
  filterLevel?: ElectricalQualificationLevel,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.workerQualifications.list(filterLevel),
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<WorkerQualification[]> => {
      let q = supabase
        .from('app_users')
        .select('id, user_id, full_name, role, electrical_qualification_level, electrical_qualification_date, electrical_qualification_verified_by');
      if (filterLevel) {
        q = q.eq('electrical_qualification_level', filterLevel);
      }
      const { data, error } = await q.order('full_name', { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message ?? 'Failed to load workers.');
      const rows = data ?? [];
      return rows.map((r) => ({
        user_id: r.user_id,
        full_name: r.full_name ?? null,
        role: r.role ?? null,
        electrical_qualification_level: (r.electrical_qualification_level ?? 'unqualified') as ElectricalQualificationLevel,
        electrical_qualification_date: r.electrical_qualification_date ?? null,
        electrical_qualification_verified_by: r.electrical_qualification_verified_by ?? null,
      }));
    },
  });
}

export function useUpdateQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.workerQualifications.all,
    mutationFn: async (params: {
      userId: string;
      level: ElectricalQualificationLevel;
      adminAuthUserId: string;
    }) => {
      const { userId, level, adminAuthUserId } = params;

      const { data: currentUser } = await supabase
        .from('app_users')
        .select('electrical_qualification_level')
        .eq('user_id', userId)
        .single();
      const previousLevel = (currentUser?.electrical_qualification_level ?? 'unqualified') as ElectricalQualificationLevel;

      const { data: adminRow } = await supabase
        .from('app_users')
        .select('id')
        .eq('user_id', adminAuthUserId)
        .single();
      const adminAppUserId = adminRow?.id ?? null;
      const now = new Date().toISOString().slice(0, 10);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);

      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          electrical_qualification_level: level,
          electrical_qualification_date: now,
          electrical_qualification_verified_by: adminAppUserId,
        })
        .eq('user_id', userId);
      if (updateError) throw new Error(updateError.message ?? 'Failed to update qualification.');

      const { data: certType } = await supabase
        .from('certification_types')
        .select('id')
        .eq('slug', 'electrical-qualification')
        .single();
      if (!certType?.id) throw new Error('Electrical qualification cert type not found');

      const { data: existing } = await supabase
        .from('certification_records')
        .select('id')
        .eq('user_id', userId)
        .eq('certification_type_id', certType.id)
        .in('status', ['pending', 'written_passed', 'active'])
        .maybeSingle();
      if (existing) {
        const { error: revokeError } = await supabase
          .from('certification_records')
          .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_by: adminAuthUserId,
          })
          .eq('id', existing.id);
        if (revokeError) throw new Error(revokeError.message ?? 'Failed to revoke previous record.');
      }

      const { error: insertError } = await supabase.from('certification_records').insert({
        user_id: userId,
        certification_type_id: certType.id,
        certified_at: new Date().toISOString(),
        certified_by: adminAuthUserId,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        previous_electrical_level: previousLevel,
        new_electrical_level: level,
      });
      if (insertError) throw new Error(insertError.message ?? 'Failed to record qualification.');
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.workerQualifications.all });
      qc.invalidateQueries({
        queryKey: queryKeys.workerQualifications.history(variables.userId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.certifications.auditLog(50) });
    },
  });
}

export interface ElectricalQualificationHistoryEntry {
  id: string;
  created_at: string;
  certified_at: string | null;
  previous_electrical_level: string | null;
  new_electrical_level: string | null;
  reviewed_by: string | null;
  certified_by: string | null;
  changed_by_name: string | null;
}

export function useElectricalQualificationHistory(
  userId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.workerQualifications.history(userId ?? ''),
    enabled: (options?.enabled ?? true) && userId != null,
    queryFn: async (): Promise<ElectricalQualificationHistoryEntry[]> => {
      if (!userId) return [];
      const { data: certType, error: typeError } = await supabase
        .from('certification_types')
        .select('id')
        .eq('slug', 'electrical-qualification')
        .single();
      if (typeError || !certType?.id) return [];

      const { data: records, error } = await supabase
        .from('certification_records')
        .select('id, created_at, certified_at, previous_electrical_level, new_electrical_level, reviewed_by, certified_by')
        .eq('user_id', userId)
        .eq('certification_type_id', certType.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message ?? 'Failed to load history.');
      const rows = records ?? [];

      const authIds = new Set<string>();
      for (const r of rows) {
        if (r.reviewed_by) authIds.add(r.reviewed_by);
        if (r.certified_by) authIds.add(r.certified_by);
      }
      const ids = Array.from(authIds);
      const nameMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: users } = await supabase
          .from('app_users')
          .select('user_id, full_name')
          .in('user_id', ids);
        for (const u of users ?? []) {
          if (u.full_name) nameMap[u.user_id] = u.full_name;
        }
      }

      return rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        certified_at: r.certified_at,
        previous_electrical_level: r.previous_electrical_level ?? null,
        new_electrical_level: r.new_electrical_level ?? null,
        reviewed_by: r.reviewed_by ?? null,
        certified_by: r.certified_by ?? null,
        changed_by_name: (r.reviewed_by && nameMap[r.reviewed_by]) ?? (r.certified_by && nameMap[r.certified_by]) ?? null,
      }));
    },
  });
}

export function useCrewQualifications(userIds: string[]) {
  return useQuery({
    queryKey: queryKeys.workerQualifications.crew(userIds),
    queryFn: async (): Promise<Record<string, ElectricalQualificationLevel>> => {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from('app_users')
        .select('user_id, electrical_qualification_level')
        .in('user_id', userIds);
      if (error) throw new Error(error.message ?? 'Failed to load crew qualifications.');
      const map: Record<string, ElectricalQualificationLevel> = {};
      for (const r of data ?? []) {
        map[r.user_id] = (r.electrical_qualification_level ?? 'unqualified') as ElectricalQualificationLevel;
      }
      return map;
    },
    enabled: userIds.length > 0,
  });
}
