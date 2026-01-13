/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAKE_DVIR_WEBHOOK_URL?: string;
  readonly VITE_MAKE_RTO_WEBHOOK_URL?: string;
  readonly VITE_MAKE_DEN_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Service Worker types
declare const self: ServiceWorkerGlobalScope;
