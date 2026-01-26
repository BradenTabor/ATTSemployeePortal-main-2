// src/lib/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV;

function log(level: LogLevel, ...args: unknown[]) {
  // Always log errors and warnings, even in production
  if (!isDev && level !== "error" && level !== "warn") return;

  const prefix =
    level === "debug"
      ? "🐛 [DEBUG]"
      : level === "info"
      ? "ℹ️ [INFO]"
      : level === "warn"
      ? "⚠️ [WARN]"
      : "❌ [ERROR]";

  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    prefix,
    ...args
  );
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
};

/**
 * Redact user ID for logging (SEC-005 security fix)
 * Returns first 4 chars + "..." + last 4 chars to prevent PII leakage
 */
export function redactUserId(userId: string | null | undefined): string {
  if (!userId) return '[no-user]';
  // Redact user ID for logging (first 4 chars + last 4 chars, middle redacted)
  if (userId.length > 8) {
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  }
  return '[redacted]';
}
