import { ReactNode, useEffect, useState, memo, useSyncExternalStore } from 'react';
import { cn } from '../lib/utils';

// Custom hook to detect client-side mount without triggering the set-state-in-effect rule
const emptySubscribe = () => () => {};
function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client: always true
    () => false  // Server: always false
  );
}

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

interface StaticBlobConfig {
  id: number;
  opacity: number;
  size: string;
  color: string;
  blur: string;
  top: string;
  left: string;
}

// Static blob configurations - no animations for better performance
const STATIC_BLOBS: StaticBlobConfig[] = [
  {
    id: 1,
    opacity: 0.25,
    size: 'w-[500px] h-[500px]',
    color: 'bg-emerald-500/30',
    blur: 'blur-[100px]',
    top: '20%',
    left: '15%',
  },
  {
    id: 2,
    opacity: 0.2,
    size: 'w-[400px] h-[400px]',
    color: 'bg-green-400/25',
    blur: 'blur-[80px]',
    top: '45%',
    left: '55%',
  },
  {
    id: 3,
    opacity: 0.15,
    size: 'w-[350px] h-[350px]',
    color: 'bg-teal-400/20',
    blur: 'blur-[90px]',
    top: '65%',
    left: '25%',
  },
];

// Mobile: single blob for less overhead
const MOBILE_BLOB: StaticBlobConfig = {
  id: 1,
  opacity: 0.2,
  size: 'w-[350px] h-[350px]',
  color: 'bg-emerald-500/25',
  blur: 'blur-[80px]',
  top: '30%',
  left: '30%',
};

function AuroraBackgroundComponent({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  const [isMobile, setIsMobile] = useState(false);
  const hasMounted = useHasMounted();

  useEffect(() => {
    // Check for mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Determine which blobs to render
  const blobs = isMobile ? [MOBILE_BLOB] : STATIC_BLOBS;

  return (
    <main>
      <div
        className={cn(
          'relative flex flex-col min-h-screen items-center justify-center bg-neutral-900 text-white transition-bg overflow-hidden',
          className
        )}
        {...props}
      >
        {/* Static Aurora Blobs - no animations */}
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {hasMounted && blobs.map((blob) => (
            <div
              key={blob.id}
              className={cn(
                'absolute rounded-full',
                blob.size,
                blob.color,
                blob.blur
              )}
              style={{
                top: blob.top,
                left: blob.left,
                opacity: blob.opacity,
              }}
            />
          ))}

          {/* Radial gradient mask */}
          {showRadialGradient && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                maskImage: 'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent" />
            </div>
          )}
        </div>

        {/* Soft Ambient Glow Overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-t from-green-500/10 via-transparent to-white/5 pointer-events-none" 
          aria-hidden="true"
        />

        {/* Page content */}
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </main>
  );
}

export const AuroraBackground = memo(AuroraBackgroundComponent);
export default AuroraBackground;
