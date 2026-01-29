/// <reference types="vite/client" />

// Global constants injected by Vite at build time
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional: push notifications (VAPID public key) */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  /** Optional: Google Maps API key */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Optional: Make.com webhooks */
  readonly VITE_MAKE_DVIR_WEBHOOK_URL?: string;
  readonly VITE_MAKE_RTO_WEBHOOK_URL?: string;
  readonly VITE_MAKE_DEN_WEBHOOK_URL?: string;
  /** Optional: app base URL (e.g. for email links) */
  readonly VITE_APP_BASE_URL?: string;
  /** Optional: set to 'false' to disable telemetry */
  readonly VITE_TELEMETRY_ENABLED?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
