import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        // Default styling to match the app's premium gold/emerald theme
        style: {
          background: '#0c0a07',
          border: '1px solid rgba(246, 220, 178, 0.2)',
          color: '#fdf4db',
        },
        classNames: {
          toast: 'rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)]',
          title: 'text-sm font-semibold',
          description: 'text-xs text-white/70',
          success: 'border-emerald-500/30 bg-emerald-950/90',
          error: 'border-red-500/30 bg-red-950/90',
          loading: 'border-[#f4c979]/30',
        },
      }}
      richColors
      closeButton
      duration={4000}
    />
  );
}
