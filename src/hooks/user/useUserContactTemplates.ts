/**
 * useUserContactTemplates Hook
 * 
 * Manages user's saved emergency contact templates for quick-fill in JSA forms.
 * Supports CRUD operations, default template selection, and usage tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface ContactTemplate {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  oc_contact: string | null;
  doc_contact: string | null;
  gf_contact: string | null;
  safety_contact: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactTemplateInput {
  name: string;
  is_default?: boolean;
  oc_contact?: string;
  doc_contact?: string;
  gf_contact?: string;
  safety_contact?: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useUserContactTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ContactTemplate[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<ContactTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    if (!user?.id) {
      setTemplates([]);
      setDefaultTemplate(null);
      setIsLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_contact_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('use_count', { ascending: false });

        if (fetchError) throw fetchError;

        const templateList = (data as ContactTemplate[]) || [];
        setTemplates(templateList);
        setDefaultTemplate(templateList.find((t) => t.is_default) || null);
      } catch (err) {
        logger.error('Failed to fetch contact templates', { error: err });
        setError('Failed to load contact templates');
        setTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [user?.id]);

  // Create a new template
  const createTemplate = useCallback(
    async (input: ContactTemplateInput): Promise<ContactTemplate | null> => {
      if (!user?.id) return null;

      try {
        const { data, error: insertError } = await supabase
          .from('user_contact_templates')
          .insert({
            user_id: user.id,
            name: input.name,
            is_default: input.is_default || false,
            oc_contact: input.oc_contact || null,
            doc_contact: input.doc_contact || null,
            gf_contact: input.gf_contact || null,
            safety_contact: input.safety_contact || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newTemplate = data as ContactTemplate;
        
        // Update local state
        setTemplates((prev) => {
          // If new template is default, unset others
          const updated = input.is_default
            ? prev.map((t) => ({ ...t, is_default: false }))
            : prev;
          return [newTemplate, ...updated];
        });

        if (newTemplate.is_default) {
          setDefaultTemplate(newTemplate);
        }

        logger.info('contact_template_created', { templateId: newTemplate.id, name: input.name });
        return newTemplate;
      } catch (err) {
        logger.error('Failed to create contact template', { error: err });
        setError('Failed to save contact template');
        return null;
      }
    },
    [user?.id]
  );

  // Update an existing template
  const updateTemplate = useCallback(
    async (id: string, input: Partial<ContactTemplateInput>): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { error: updateError } = await supabase
          .from('user_contact_templates')
          .update({
            ...input,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Update local state
        setTemplates((prev) =>
          prev.map((t) => {
            if (t.id === id) {
              return { ...t, ...input };
            }
            // If updated template is now default, unset others
            if (input.is_default && t.id !== id) {
              return { ...t, is_default: false };
            }
            return t;
          })
        );

        // Update default template reference
        if (input.is_default) {
          const updated = templates.find((t) => t.id === id);
          if (updated) {
            setDefaultTemplate({ ...updated, ...input, is_default: true });
          }
        }

        logger.info('contact_template_updated', { templateId: id });
        return true;
      } catch (err) {
        logger.error('Failed to update contact template', { error: err });
        setError('Failed to update contact template');
        return false;
      }
    },
    [user?.id, templates]
  );

  // Delete a template
  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user?.id) return false;

      try {
        const { error: deleteError } = await supabase
          .from('user_contact_templates')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        // Update local state
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        
        if (defaultTemplate?.id === id) {
          setDefaultTemplate(null);
        }

        logger.info('contact_template_deleted', { templateId: id });
        return true;
      } catch (err) {
        logger.error('Failed to delete contact template', { error: err });
        setError('Failed to delete contact template');
        return false;
      }
    },
    [user?.id, defaultTemplate]
  );

  // Set a template as default
  const setAsDefault = useCallback(
    async (id: string): Promise<boolean> => {
      return updateTemplate(id, { is_default: true });
    },
    [updateTemplate]
  );

  // Record template usage (for sorting by frequency)
  const recordUsage = useCallback(
    async (id: string): Promise<void> => {
      if (!user?.id) return;

      try {
        // Increment use_count and update last_used_at
        const { error: updateError } = await supabase.rpc('increment_contact_template_usage', {
          template_id: id,
        });

        // Fallback if RPC doesn't exist
        if (updateError) {
          await supabase
            .from('user_contact_templates')
            .update({
              use_count: (templates.find((t) => t.id === id)?.use_count || 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id);
        }

        // Update local state
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, use_count: t.use_count + 1, last_used_at: new Date().toISOString() }
              : t
          )
        );
      } catch {
        // Silent fail - usage tracking is non-critical
        logger.warn('Failed to record template usage', { templateId: id });
      }
    },
    [user?.id, templates]
  );

  // Save current form contacts as a new template
  const saveCurrentAsTemplate = useCallback(
    async (
      name: string,
      contacts: { oc?: string; doc?: string; gf?: string; safety?: string },
      makeDefault = false
    ): Promise<ContactTemplate | null> => {
      return createTemplate({
        name,
        is_default: makeDefault,
        oc_contact: contacts.oc,
        doc_contact: contacts.doc,
        gf_contact: contacts.gf,
        safety_contact: contacts.safety,
      });
    },
    [createTemplate]
  );

  return {
    templates,
    defaultTemplate,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    recordUsage,
    saveCurrentAsTemplate,
  };
}
