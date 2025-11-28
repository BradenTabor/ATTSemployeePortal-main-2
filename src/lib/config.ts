// src/lib/config.ts
export const CONFIG = {
    make: {
      dvirWebhook: import.meta.env.VITE_MAKE_DVIR_WEBHOOK_URL,
      rtoWebhook: import.meta.env.VITE_MAKE_RTO_WEBHOOK_URL,
    },
  };
  