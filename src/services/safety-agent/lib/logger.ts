/**
 * Structured logger for the Safety + Compliance Agent
 * 
 * Provides consistent, structured logging with context for
 * compliance runs, notifications, and debugging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  runId?: string;
  dateFor?: string;
  userId?: string;
  notificationType?: string;
  [key: string]: unknown;
}

// Declare globals for cross-runtime compatibility
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

// Detect environment - works in both Node/Vite and Deno
const isDeno = typeof Deno !== 'undefined';
const isDev = isDeno 
  ? Deno?.env.get('ENVIRONMENT') !== 'production'
  : typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production';

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [safety-agent] [${level.toUpperCase()}]`;
  
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  // In production, only log warnings and errors for regular logs
  // But always log if it has a runId (compliance run tracking)
  if (!isDev && level !== 'error' && level !== 'warn' && !context?.runId) {
    return;
  }

  const formattedMessage = formatMessage(level, message, context);

  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

/**
 * Structured logger for safety-agent operations
 */
export const safetyLogger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  /**
   * Log the start of a compliance run
   */
  runStart: (runId: string, dateFor: string, options: Record<string, unknown>) => {
    log('info', 'Compliance run started', { runId, dateFor, ...options });
  },

  /**
   * Log the end of a compliance run
   */
  runEnd: (runId: string, result: Record<string, unknown>) => {
    log('info', 'Compliance run completed', { runId, ...result });
  },

  /**
   * Log a notification being sent
   */
  notificationSent: (
    runId: string,
    userId: string,
    notificationType: string,
    email: string
  ) => {
    log('info', 'Notification sent', { runId, userId, notificationType, email });
  },

  /**
   * Log a notification being skipped (duplicate or dry-run)
   */
  notificationSkipped: (
    runId: string,
    userId: string,
    notificationType: string,
    reason: string
  ) => {
    log('debug', 'Notification skipped', { runId, userId, notificationType, reason });
  },

  /**
   * Log a webhook call
   */
  webhookCall: (
    runId: string,
    userId: string,
    success: boolean,
    response?: unknown
  ) => {
    log(success ? 'info' : 'error', `Webhook ${success ? 'succeeded' : 'failed'}`, {
      runId,
      userId,
      response: response ? JSON.stringify(response).slice(0, 200) : undefined,
    });
  },

  /**
   * Log a database operation
   */
  dbOperation: (
    operation: string,
    table: string,
    success: boolean,
    details?: Record<string, unknown>
  ) => {
    log(success ? 'debug' : 'error', `DB ${operation} on ${table}`, {
      success,
      ...details,
    });
  },
};

export default safetyLogger;

