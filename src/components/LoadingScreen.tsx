import { memo } from "react";

/**
 * LoadingScreen component - optimized with CSS animations
 * Uses pure CSS for animations instead of framer-motion for better performance
 */
function LoadingScreenComponent() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-center opacity-0 animate-fadeIn">
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Outer ring - slower rotation */}
          <div 
            className="absolute inset-0 border-4 border-green-500/20 rounded-full animate-spin"
            style={{ animationDuration: '2s' }}
          />
          {/* Inner ring - faster rotation */}
          <div 
            className="absolute inset-2 border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"
            style={{ animationDuration: '1s' }}
          />
        </div>
        <p className="text-green-500 text-lg font-semibold tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
}

const LoadingScreen = memo(LoadingScreenComponent);
export default LoadingScreen;
