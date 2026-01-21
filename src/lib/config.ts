// src/lib/config.ts

/**
 * Application configuration
 *
 * Environment variables are loaded from .env files via Vite.
 * All VITE_ prefixed variables are available client-side.
 */
export const CONFIG = {
  /**
   * Make.com webhook integrations
   */
  make: {
    dvirWebhook: import.meta.env.VITE_MAKE_DVIR_WEBHOOK_URL,
    rtoWebhook: import.meta.env.VITE_MAKE_RTO_WEBHOOK_URL,
  },

  /**
   * Telemetry configuration
   *
   * Controls event tracking for form analytics, engagement metrics,
   * and ROI measurement.
   *
   * @see docs/Telemetry_plan.md for full documentation
   */
  telemetry: {
    /**
     * Enable/disable telemetry tracking.
     *
     * Set VITE_TELEMETRY_ENABLED=false in .env to disable.
     * Defaults to true in production, false in development.
     */
    enabled: import.meta.env.VITE_TELEMETRY_ENABLED !== 'false',

    /**
     * Batch flush interval in milliseconds.
     * Events are queued and flushed in batches for performance.
     */
    batchIntervalMs: 5000,

    /**
     * Maximum events per batch insert.
     */
    maxBatchSize: 50,
  },
};
  