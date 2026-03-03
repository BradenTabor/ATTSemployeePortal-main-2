import { forwardRef } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { queryClient } from '../../lib/queryClient';
import { logger } from '../../lib/logger';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
          <p className="text-sm text-white/60">
            An unexpected error occurred. Please try again.
          </p>
        </div>

        {import.meta.env.DEV && (
          <pre className="text-left text-xs bg-red-950/50 border border-red-500/20 rounded-xl p-4 overflow-auto max-h-32 text-red-300">
            {error.message}
          </pre>
        )}

        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export const AppErrorBoundary = forwardRef<HTMLDivElement, AppErrorBoundaryProps>(
  function AppErrorBoundary({ children, onReset }, ref) {
    return (
      <div ref={ref}>
        <ReactErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error, info) => {
            logger.error('React Error Boundary caught error:', error);
            logger.error('Component stack:', info.componentStack);
          }}
          onReset={() => {
            queryClient.clear();
            onReset?.();
          }}
        >
          {children}
        </ReactErrorBoundary>
      </div>
    );
  }
);

// Page-level error boundary with smaller UI
export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      fallback={
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 font-medium">Failed to load this section.</p>
          <p className="text-sm text-white/50 mt-1">Please refresh the page to try again.</p>
        </div>
      }
      onError={(error) => logger.error('Page error:', error)}
    >
      {children}
    </ReactErrorBoundary>
  );
}

// Legacy export for backwards compatibility with main.tsx
// This wraps the new AppErrorBoundary
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return <AppErrorBoundary>{children}</AppErrorBoundary>;
}
