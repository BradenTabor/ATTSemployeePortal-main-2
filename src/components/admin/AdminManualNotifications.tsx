/**
 * AdminManualNotifications Component
 * 
 * Premium admin panel for sending manual push notifications to users.
 * Supports targeting all users, specific roles, job crews, or individual users.
 * 
 * SECURITY:
 * - Component only renders if user has 'admin' role
 * - Calls admin-create-notification Edge Function (auth handled server-side)
 * - All actions are logged for audit purposes
 */

import { useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  User, 
  Briefcase,
  Megaphone,
  ShieldAlert,
  Calendar,
  Clock,
  AlertCircle,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
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
  severity: 'medium',
  targetType: 'all',
  targetRef: '',
};

// Category icons mapping
const CATEGORY_ICONS: Record<NotificationCategory, React.ReactNode> = {
  announcement: <Megaphone className="w-4 h-4" />,
  safety_alert: <ShieldAlert className="w-4 h-4" />,
  job_update: <Briefcase className="w-4 h-4" />,
  schedule: <Calendar className="w-4 h-4" />,
  rto_decision: <Clock className="w-4 h-4" />,
  admin_notice: <AlertCircle className="w-4 h-4" />,
};

// Severity color mapping
const SEVERITY_STYLES: Record<NotificationSeverity, { bg: string; border: string; text: string; glow: string }> = {
  low: { 
    bg: 'bg-[#1a1814]/80', 
    border: 'border-[#f4c979]/30', 
    text: 'text-[#f8e5bb]',
    glow: '',
  },
  medium: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/40', 
    text: 'text-amber-300',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
  },
  high: { 
    bg: 'bg-orange-500/15', 
    border: 'border-orange-500/50', 
    text: 'text-orange-300',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]',
  },
  critical: { 
    bg: 'bg-red-500/15', 
    border: 'border-red-500/50', 
    text: 'text-red-300',
    glow: 'shadow-[0_0_25px_rgba(239,68,68,0.25)]',
  },
};

function AdminManualNotificationsComponent() {
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

  // Computed values
  const severityStyle = useMemo(() => SEVERITY_STYLES[formState.severity], [formState.severity]);
  const categoryIcon = useMemo(() => CATEGORY_ICONS[formState.category], [formState.category]);

  // Update form field
  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setResult(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if ((formState.targetType === 'role' || formState.targetType === 'crew') && !formState.targetRef) {
      toast.error(`Please select a ${formState.targetType === 'role' ? 'role' : 'job'} to target`);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload: CreateNotificationRequest = {
        category: formState.category,
        severity: formState.severity,
        target_type: formState.targetType,
        title: formState.title.trim(),
        body: formState.body.trim() || undefined,
        url: '/dashboard',
      };

      // Add target_ref based on target type
      if (formState.targetType === 'user') {
        payload.target_ref = user?.id;
      } else if (formState.targetType === 'role' || formState.targetType === 'crew') {
        payload.target_ref = formState.targetRef;
      }

      console.log('[AdminManualNotifications] Sending notification:', payload);

      const { data, error } = await supabase.functions.invoke<CreateNotificationResponse | CreateNotificationErrorResponse>(
        'admin-create-notification',
        { body: payload }
      );

      if (error) {
        console.error('[AdminManualNotifications] Edge Function error:', error);
        throw new Error(error.message || 'Failed to send notification');
      }

      if (!data) {
        throw new Error('No response from server');
      }

      if ('success' in data && data.success === false) {
        const errorData = data as CreateNotificationErrorResponse;
        throw new Error(errorData.error || 'Unknown error');
      }

      const successData = data as CreateNotificationResponse;
      console.log('[AdminManualNotifications] Success:', successData);

      setResult({
        type: 'success',
        message: `Notification delivered successfully!`,
        eventId: successData.event_id,
        dispatched: successData.dispatched,
        skipped: successData.skipped,
      });

      toast.success('Notification sent!', `Delivered to ${successData.dispatched} user(s)`);
      setFormState(initialFormState);

    } catch (err) {
      console.error('[AdminManualNotifications] Error:', err);
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

  // Don't render for non-admins
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

  // Get target label
  const getTargetLabel = (type: NotificationTargetType): string => {
    switch (type) {
      case 'user': return 'Preview (Just Me)';
      case 'all': return 'All Users';
      case 'role': return 'By Role';
      case 'crew': return 'Job Crew';
      default: return '';
    }
  };

  return (
    <div className="relative space-y-6">
      {/* Quick Stats / Preview Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${severityStyle.bg} border ${severityStyle.border} ${severityStyle.glow} transition-all`}>
          <Zap className={`w-3.5 h-3.5 ${severityStyle.text}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${severityStyle.text}`}>
            {formState.severity} Priority
          </span>
        </div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20">
          {categoryIcon}
          <span className="text-xs font-medium text-[#f8e5bb]/80">
            {NOTIFICATION_CATEGORIES.find(c => c.value === formState.category)?.label}
          </span>
        </div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20">
          {getTargetIcon(formState.targetType)}
          <span className="text-xs font-medium text-[#f8e5bb]/80">
            {getTargetLabel(formState.targetType)}
          </span>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title Input */}
        <div className="space-y-2">
          <label 
            htmlFor="notification-title" 
            className="flex items-center gap-2 text-sm font-semibold text-[#f8e5bb]"
          >
            <span>Notification Title</span>
            <span className="text-[#f4c979]">*</span>
          </label>
          <input
            id="notification-title"
            type="text"
            value={formState.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Enter a clear, concise title..."
            required
            maxLength={100}
            className="w-full px-4 py-3.5 rounded-2xl bg-[#0c0a08]/80 border border-[#f4c979]/25 text-[#fff6dd] placeholder-[#f8e5bb]/35 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 focus:border-[#f4c979]/50 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
          />
          <p className="text-[10px] text-[#f8e5bb]/40 pl-1">
            {formState.title.length}/100 characters
          </p>
        </div>

        {/* Body Textarea */}
        <div className="space-y-2">
          <label 
            htmlFor="notification-body" 
            className="flex items-center gap-2 text-sm font-semibold text-[#f8e5bb]"
          >
            <span>Message Body</span>
            <span className="text-[#f8e5bb]/40 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="notification-body"
            value={formState.body}
            onChange={(e) => updateField('body', e.target.value)}
            placeholder="Add additional details or context..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3.5 rounded-2xl bg-[#0c0a08]/80 border border-[#f4c979]/25 text-[#fff6dd] placeholder-[#f8e5bb]/35 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 focus:border-[#f4c979]/50 transition-all resize-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
          />
          <p className="text-[10px] text-[#f8e5bb]/40 pl-1">
            {formState.body.length}/500 characters
          </p>
        </div>

        {/* Category Pills */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[#f8e5bb]">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => updateField('category', cat.value)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                  formState.category === cat.value
                    ? 'bg-gradient-to-br from-[#f4c979]/25 to-[#d79a32]/15 border-[#f4c979]/50 text-[#f4c979] shadow-[0_0_20px_rgba(244,201,121,0.15)]'
                    : 'bg-[#0c0a08]/60 border-[#f4c979]/15 text-[#f8e5bb]/60 hover:border-[#f4c979]/30 hover:text-[#f8e5bb]/80 hover:bg-[#0c0a08]/80'
                }`}
              >
                {CATEGORY_ICONS[cat.value]}
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Severity Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[#f8e5bb]">
            Priority Level
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NOTIFICATION_SEVERITIES.map(sev => {
              const style = SEVERITY_STYLES[sev.value];
              const isSelected = formState.severity === sev.value;
              
              return (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => updateField('severity', sev.value)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? `${style.bg} ${style.border} ${style.text} ${style.glow}`
                      : 'bg-[#0c0a08]/60 border-[#f4c979]/15 text-[#f8e5bb]/50 hover:border-[#f4c979]/25'
                  }`}
                >
                  <span className="text-sm font-semibold">{sev.label}</span>
                  {sev.value === 'critical' && (
                    <span className="text-[9px] uppercase tracking-wider opacity-70">Urgent</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[#f8e5bb]">
            Target Audience
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NOTIFICATION_TARGET_TYPES.map(target => (
              <button
                key={target.value}
                type="button"
                onClick={() => {
                  updateField('targetType', target.value);
                  updateField('targetRef', '');
                }}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                  formState.targetType === target.value
                    ? 'bg-gradient-to-br from-[#f4c979]/25 to-[#d79a32]/15 border-[#f4c979]/50 text-[#f4c979] shadow-[0_0_20px_rgba(244,201,121,0.15)]'
                    : 'bg-[#0c0a08]/60 border-[#f4c979]/15 text-[#f8e5bb]/60 hover:border-[#f4c979]/30 hover:text-[#f8e5bb]/80'
                }`}
              >
                {getTargetIcon(target.value)}
                <span className="text-sm font-medium">{getTargetLabel(target.value)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conditional Target Ref Selection */}
        <AnimatePresence mode="wait">
          {formState.targetType === 'role' && (
            <motion.div 
              key="role-select"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 overflow-hidden"
            >
              <label 
                htmlFor="notification-role" 
                className="block text-sm font-semibold text-[#f8e5bb]"
              >
                Select Role
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {TARGETABLE_ROLES.map(roleOption => (
                  <button
                    key={roleOption.value}
                    type="button"
                    onClick={() => updateField('targetRef', roleOption.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm ${
                      formState.targetRef === roleOption.value
                        ? 'bg-[#f4c979]/15 border-[#f4c979]/50 text-[#f4c979]'
                        : 'bg-[#0c0a08]/60 border-[#f4c979]/15 text-[#f8e5bb]/60 hover:border-[#f4c979]/30'
                    }`}
                  >
                    {roleOption.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {formState.targetType === 'crew' && (
            <motion.div 
              key="crew-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 overflow-hidden"
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
                className="w-full px-4 py-3 rounded-xl bg-[#0c0a08]/80 border border-[#f4c979]/25 text-[#fff6dd] placeholder-[#f8e5bb]/35 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 focus:border-[#f4c979]/50 transition-all"
              />
              <p className="text-xs text-[#f8e5bb]/40 pl-1">
                All crew members assigned to this job will receive the notification
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Message */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`p-5 rounded-2xl border ${
                result.type === 'success'
                  ? 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                  : 'bg-gradient-to-br from-red-500/15 to-red-600/10 border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)]'
              }`}
            >
              <div className="flex items-start gap-4">
                {result.type === 'success' ? (
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/30">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${result.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {result.message}
                  </p>
                  {result.type === 'success' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-3 text-sm text-emerald-300/80">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <strong>{result.dispatched}</strong> delivered
                        </span>
                        <span className="text-emerald-300/40">|</span>
                        <span className="text-emerald-300/60">{result.skipped} skipped</span>
                      </div>
                      <p className="text-xs text-emerald-300/50 font-mono">
                        Event: {result.eventId?.slice(0, 8)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={loading || !formState.title.trim()}
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-[#0c0b09] bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] hover:from-[#fff6dd] hover:via-[#f8e5bb] hover:to-[#f4c979] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#0c0b09] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_15px_40px_rgba(244,201,121,0.25)] hover:shadow-[0_20px_50px_rgba(244,201,121,0.35)]"
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-[#0c0b09]/30 border-t-[#0c0b09] rounded-full"
              />
              <span>Sending Notification...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Send Push Notification</span>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </>
          )}
        </motion.button>

        {/* Footer Notice */}
        <p className="text-[10px] text-[#f8e5bb]/30 text-center leading-relaxed">
          Notifications are delivered instantly via push. All actions are logged for audit purposes.
          <br />
          Users with notifications disabled will not receive this message.
        </p>
      </form>
    </div>
  );
}

export const AdminManualNotifications = memo(AdminManualNotificationsComponent);
export default AdminManualNotifications;


