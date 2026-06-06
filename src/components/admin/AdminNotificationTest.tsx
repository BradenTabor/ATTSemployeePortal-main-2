/**
 * AdminNotificationTest Component
 * 
 * Secure admin-only panel for testing the notification system.
 * 
 * SECURITY:
 * - Component only renders if user has 'admin' role
 * - Calls admin-create-notification Edge Function (which handles auth server-side)
 * - NEVER includes INTERNAL_SECRET or any server secrets
 */

import { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, AlertTriangle, Users, User, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { logger } from '../../lib/logger';
import {
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationTargetType,
  type CreateNotificationRequest,
  type CreateNotificationResponse,
  type CreateNotificationErrorResponse,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TARGET_TYPES,
  TARGETABLE_ROLES,
} from '../../types/notifications';

interface FormState {
  title: string;
  body: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  targetType: NotificationTargetType;
  targetRef: string;
}

const initialFormState: FormState = {
  title: '',
  body: '',
  category: 'announcement',
  severity: 'low',
  targetType: 'user',
  targetRef: '',
};

function AdminNotificationTestComponent() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
    eventId?: string;
    dispatched?: number;
    skipped?: number;
  } | null>(null);

  // Update form field
  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setResult(null); // Clear previous result when form changes
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Validate target_ref for role and crew targets
    if ((formState.targetType === 'role' || formState.targetType === 'crew') && !formState.targetRef) {
      toast.error(`Please select a ${formState.targetType === 'role' ? 'role' : 'job'} to target`);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Build request payload
      const payload: CreateNotificationRequest = {
        category: formState.category,
        severity: formState.severity,
        target_type: formState.targetType,
        title: formState.title.trim(),
        body: formState.body.trim() || undefined,
        url: '/dashboard', // Default to dashboard
      };

      // Add target_ref based on target type
      if (formState.targetType === 'user') {
        // "Just Me" - use current user's ID
        payload.target_ref = user?.id;
      } else if (formState.targetType === 'role' || formState.targetType === 'crew') {
        payload.target_ref = formState.targetRef;
      }
      // 'all' doesn't need target_ref

      logger.info('[AdminNotificationTest] Sending notification:', payload);

      // Call the secure admin Edge Function
      const { data, error } = await supabase.functions.invoke<CreateNotificationResponse | CreateNotificationErrorResponse>(
        'admin-create-notification',
        { body: payload }
      );

      if (error) {
        logger.error('[AdminNotificationTest] Edge Function error:', error);
        throw new Error(error.message || 'Failed to send notification');
      }

      if (!data) {
        throw new Error('No response from server');
      }

      // Check if response indicates failure
      if ('success' in data && data.success === false) {
        const errorData = data as CreateNotificationErrorResponse;
        throw new Error(errorData.error || 'Unknown error');
      }

      // Success!
      const successData = data as CreateNotificationResponse;
      logger.info('[AdminNotificationTest] Success:', successData);

      setResult({
        type: 'success',
        message: `Notification sent successfully!`,
        eventId: successData.event_id,
        dispatched: successData.dispatched,
        skipped: successData.skipped,
      });

      toast.success('Notification sent!', `Dispatched to ${successData.dispatched} user(s)`);

      // Reset form on success
      setFormState(initialFormState);

    } catch (err) {
      logger.error('[AdminNotificationTest] Error:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      
      setResult({
        type: 'error',
        message,
      });

      toast.error('Failed to send notification', message);
    } finally {
      setLoading(false);
    }
  }, [formState, user?.id]);

  // Don't render for non-admins (security gate at component level)
  if (!isAdmin) {
    return null;
  }

  // Get target type icon
  const getTargetIcon = (type: NotificationTargetType) => {
    switch (type) {
      case 'user': return <User className="w-4 h-4" />;
      case 'all': return <Users className="w-4 h-4" />;
      case 'role': return <Users className="w-4 h-4" />;
      case 'crew': return <Briefcase className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="relative">
      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title Input */}
        <div className="space-y-2">
          <label 
            htmlFor="notification-title" 
            className="block text-sm font-semibold text-[#f8e5bb]"
          >
            Title <span className="text-[#f4c979]">*</span>
          </label>
          <input
            id="notification-title"
            type="text"
            value={formState.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Enter notification title..."
            required
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] placeholder-[#f8e5bb]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all"
          />
        </div>

        {/* Body Textarea */}
        <div className="space-y-2">
          <label 
            htmlFor="notification-body" 
            className="block text-sm font-semibold text-[#f8e5bb]"
          >
            Body <span className="text-[#f8e5bb]/50">(optional)</span>
          </label>
          <textarea
            id="notification-body"
            value={formState.body}
            onChange={(e) => updateField('body', e.target.value)}
            placeholder="Enter notification message..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] placeholder-[#f8e5bb]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all resize-none"
          />
        </div>

        {/* Category and Severity Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category Select */}
          <div className="space-y-2">
            <label 
              htmlFor="notification-category" 
              className="block text-sm font-semibold text-[#f8e5bb]"
            >
              Category
            </label>
            <select
              id="notification-category"
              value={formState.category}
              onChange={(e) => updateField('category', e.target.value as NotificationCategory)}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all appearance-none cursor-pointer"
            >
              {NOTIFICATION_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Select */}
          <div className="space-y-2">
            <label 
              htmlFor="notification-severity" 
              className="block text-sm font-semibold text-[#f8e5bb]"
            >
              Severity
            </label>
            <select
              id="notification-severity"
              value={formState.severity}
              onChange={(e) => updateField('severity', e.target.value as NotificationSeverity)}
              className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all appearance-none cursor-pointer"
            >
              {NOTIFICATION_SEVERITIES.map(sev => (
                <option key={sev.value} value={sev.value}>
                  {sev.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Type Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#f8e5bb]">
            Send To
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NOTIFICATION_TARGET_TYPES.map(target => (
              <button
                key={target.value}
                type="button"
                onClick={() => {
                  updateField('targetType', target.value);
                  updateField('targetRef', ''); // Reset target ref when type changes
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                  formState.targetType === target.value
                    ? 'bg-[#f4c979]/20 border-[#f4c979]/60 text-[#f4c979]'
                    : 'bg-[#1a1814]/60 border-[#f4c979]/20 text-[#f8e5bb]/70 hover:border-[#f4c979]/40 hover:bg-[#1a1814]/80'
                }`}
              >
                {getTargetIcon(target.value)}
                <span className="text-sm font-medium">{target.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conditional Target Ref Input */}
        {formState.targetType === 'role' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <label 
              htmlFor="notification-role" 
              className="block text-sm font-semibold text-[#f8e5bb]"
            >
              Select Role
            </label>
            <select
              id="notification-role"
              value={formState.targetRef}
              onChange={(e) => updateField('targetRef', e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all appearance-none cursor-pointer"
            >
              <option value="">Choose a role...</option>
              {TARGETABLE_ROLES.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {formState.targetType === 'crew' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <label 
              htmlFor="notification-job" 
              className="block text-sm font-semibold text-[#f8e5bb]"
            >
              Job ID
            </label>
            <input
              id="notification-job"
              type="text"
              value={formState.targetRef}
              onChange={(e) => updateField('targetRef', e.target.value)}
              placeholder="Enter job UUID..."
              required
              className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] placeholder-[#f8e5bb]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:border-[#f4c979]/60 transition-all"
            />
            <p className="text-xs text-[#f8e5bb]/50">
              Enter the UUID of the job whose crew should receive this notification
            </p>
          </motion.div>
        )}

        {/* Result Message */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${
              result.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{result.message}</p>
                {result.type === 'success' && (
                  <div className="mt-2 text-sm opacity-80 space-y-1">
                    <p>Event ID: <code className="text-xs bg-black/20 px-1.5 py-0.5 rounded">{result.eventId}</code></p>
                    <p>Dispatched: {result.dispatched} | Skipped: {result.skipped}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !formState.title.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-[#0c0b09] bg-gradient-to-r from-[#f4c979] via-[#f8e5bb] to-[#f4c979] hover:from-[#f8e5bb] hover:via-[#fff6dd] hover:to-[#f8e5bb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#f4c979]/20 hover:shadow-[#f4c979]/30"
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-[#0c0b09]/30 border-t-[#0c0b09] rounded-full"
              />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Send Test Notification</span>
            </>
          )}
        </button>

        {/* Security Notice */}
        <p className="text-xs text-[#f8e5bb]/40 text-center">
          This notification will be processed through the secure admin gateway.
          All actions are logged for audit purposes.
        </p>
      </form>
    </div>
  );
}

export const AdminNotificationTest = memo(AdminNotificationTestComponent);
export default AdminNotificationTest;

