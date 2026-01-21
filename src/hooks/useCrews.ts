/**
 * useCrews Hook
 * 
 * CRUD operations for crews and crew members.
 * Used in the Admin Operations Hub for team management.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface Crew {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  member_count?: number;
}

export interface CrewMember {
  id: string;
  crew_id: string;
  user_id: string;
  added_at: string;
  added_by: string | null;
  // Joined user data
  email?: string;
  full_name?: string | null;
  role?: string;
}

export interface CrewWithMembers extends Crew {
  members: CrewMember[];
}

export interface CrewFormData {
  name: string;
  description: string;
  member_ids: string[];
}

export interface UseCrewsReturn {
  crews: Crew[];
  loading: boolean;
  error: string | null;
  // CRUD operations
  createCrew: (data: CrewFormData, userId: string) => Promise<{ success: boolean; error?: string; crew?: Crew }>;
  updateCrew: (crewId: string, data: Partial<CrewFormData>) => Promise<{ success: boolean; error?: string }>;
  deleteCrew: (crewId: string) => Promise<{ success: boolean; error?: string }>;
  toggleCrewActive: (crewId: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
  // Member operations
  getCrewMembers: (crewId: string) => Promise<CrewMember[]>;
  addCrewMember: (crewId: string, userId: string, addedBy: string) => Promise<{ success: boolean; error?: string }>;
  removeCrewMember: (crewId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  setCrewMembers: (crewId: string, userIds: string[], addedBy: string) => Promise<{ success: boolean; error?: string }>;
  // Refresh
  refetch: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useCrews(): UseCrewsReturn {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all crews with member counts
  const fetchCrews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('crew_with_member_count')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      setCrews(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch crews';
      logger.error('[useCrews] Fetch error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCrews();
  }, [fetchCrews]);

  // Create a new crew with optional members
  const createCrew = useCallback(async (
    data: CrewFormData,
    userId: string
  ): Promise<{ success: boolean; error?: string; crew?: Crew }> => {
    try {
      // Create the crew
      const { data: crew, error: createError } = await supabase
        .from('crews')
        .insert({
          name: data.name.trim(),
          description: data.description.trim() || null,
          created_by: userId,
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          return { success: false, error: 'A crew with this name already exists' };
        }
        throw createError;
      }

      // Add members if provided
      if (data.member_ids.length > 0) {
        const memberInserts = data.member_ids.map(memberId => ({
          crew_id: crew.id,
          user_id: memberId,
          added_by: userId,
        }));

        const { error: memberError } = await supabase
          .from('crew_members')
          .insert(memberInserts);

        if (memberError) {
          logger.error('[useCrews] Failed to add members:', memberError);
          // Don't fail the whole operation, crew was created
        }
      }

      await fetchCrews();
      return { success: true, crew };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create crew';
      logger.error('[useCrews] Create error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Update crew details
  const updateCrew = useCallback(async (
    crewId: string,
    data: Partial<CrewFormData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const updates: Record<string, unknown> = {};
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.description !== undefined) updates.description = data.description.trim() || null;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('crews')
          .update(updates)
          .eq('id', crewId);

        if (updateError) {
          if (updateError.code === '23505') {
            return { success: false, error: 'A crew with this name already exists' };
          }
          throw updateError;
        }
      }

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update crew';
      logger.error('[useCrews] Update error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Delete a crew
  const deleteCrew = useCallback(async (
    crewId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('crews')
        .delete()
        .eq('id', crewId);

      if (deleteError) throw deleteError;

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete crew';
      logger.error('[useCrews] Delete error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Toggle crew active status
  const toggleCrewActive = useCallback(async (
    crewId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from('crews')
        .update({ is_active: isActive })
        .eq('id', crewId);

      if (updateError) throw updateError;

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update crew status';
      logger.error('[useCrews] Toggle error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Get members of a specific crew
  const getCrewMembers = useCallback(async (crewId: string): Promise<CrewMember[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('crew_members')
        .select(`
          id,
          crew_id,
          user_id,
          added_at,
          added_by
        `)
        .eq('crew_id', crewId);

      if (fetchError) throw fetchError;

      // Fetch user details for each member
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: users } = await supabase
          .from('app_users')
          .select('user_id, email, full_name, role')
          .in('user_id', userIds);

        const userMap = new Map(users?.map(u => [u.user_id, u]) || []);
        
        return data.map(member => ({
          ...member,
          email: userMap.get(member.user_id)?.email,
          full_name: userMap.get(member.user_id)?.full_name,
          role: userMap.get(member.user_id)?.role,
        }));
      }

      return data || [];
    } catch (err) {
      logger.error('[useCrews] Get members error:', err);
      return [];
    }
  }, []);

  // Add a single member to a crew
  const addCrewMember = useCallback(async (
    crewId: string,
    userId: string,
    addedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: insertError } = await supabase
        .from('crew_members')
        .insert({
          crew_id: crewId,
          user_id: userId,
          added_by: addedBy,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          return { success: false, error: 'User is already a member of this crew' };
        }
        throw insertError;
      }

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member';
      logger.error('[useCrews] Add member error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Remove a member from a crew
  const removeCrewMember = useCallback(async (
    crewId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      logger.error('[useCrews] Remove member error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  // Set all members of a crew (replace existing)
  const setCrewMembers = useCallback(async (
    crewId: string,
    userIds: string[],
    addedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Delete all existing members
      const { error: deleteError } = await supabase
        .from('crew_members')
        .delete()
        .eq('crew_id', crewId);

      if (deleteError) throw deleteError;

      // Add new members
      if (userIds.length > 0) {
        const memberInserts = userIds.map(userId => ({
          crew_id: crewId,
          user_id: userId,
          added_by: addedBy,
        }));

        const { error: insertError } = await supabase
          .from('crew_members')
          .insert(memberInserts);

        if (insertError) throw insertError;
      }

      await fetchCrews();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update crew members';
      logger.error('[useCrews] Set members error:', err);
      return { success: false, error: message };
    }
  }, [fetchCrews]);

  return {
    crews,
    loading,
    error,
    createCrew,
    updateCrew,
    deleteCrew,
    toggleCrewActive,
    getCrewMembers,
    addCrewMember,
    removeCrewMember,
    setCrewMembers,
    refetch: fetchCrews,
  };
}

// =============================================================================
// HELPER HOOK: useCrewDetails
// Fetch a single crew with its members
// =============================================================================

export function useCrewDetails(crewId: string | null) {
  const [crew, setCrew] = useState<CrewWithMembers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCrewDetails = useCallback(async () => {
    if (!crewId) {
      setCrew(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch crew
      const { data: crewData, error: crewError } = await supabase
        .from('crews')
        .select('*')
        .eq('id', crewId)
        .single();

      if (crewError) throw crewError;

      // Fetch members with user details
      const { data: membersData, error: membersError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('crew_id', crewId);

      if (membersError) throw membersError;

      // Get user details
      let members: CrewMember[] = membersData || [];
      if (members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: users } = await supabase
          .from('app_users')
          .select('user_id, email, full_name, role')
          .in('user_id', userIds);

        const userMap = new Map(users?.map(u => [u.user_id, u]) || []);
        members = members.map(m => ({
          ...m,
          email: userMap.get(m.user_id)?.email,
          full_name: userMap.get(m.user_id)?.full_name,
          role: userMap.get(m.user_id)?.role,
        }));
      }

      setCrew({
        ...crewData,
        members,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch crew details';
      logger.error('[useCrewDetails] Error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [crewId]);

  useEffect(() => {
    fetchCrewDetails();
  }, [fetchCrewDetails]);

  return { crew, loading, error, refetch: fetchCrewDetails };
}
