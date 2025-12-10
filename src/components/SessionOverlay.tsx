import { useEffect } from "react";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface SessionOverlayProps {
  isLoading: boolean;
  playSound?: boolean;
}

export default function SessionOverlay({ isLoading, playSound = false }: SessionOverlayProps) {
  // Optional ambient sound cue on mount
  useEffect(() => {
    if (isLoading && playSound) {
      const audio = new Audio("/assets/login-chime.mp3");
      audio.volume = 0.2;
      audio.play().catch(() => {
        // Silently fail if audio cannot play (user hasn't interacted yet, autoplay policy, etc.)
      });
    }
  }, [isLoading, playSound]);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white z-[100] animate-fade-in"
    >
      <div className="flex flex-col items-center space-y-6 relative animate-scale-in">
        {/* Glowing Pulse Behind Logo - CSS animation */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-48 h-48 bg-green-500/20 rounded-full blur-3xl animate-pulse-glow"
          />

          {/* ATTS Logo - CSS animation */}
          <img
            src={logo}
            alt="ATTS Logo"
            className="w-32 h-32 object-contain relative z-10 animate-logo-pulse"
          />
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold tracking-wide text-white">
            Restoring your session...
          </p>
          <p className="text-sm text-white/70 font-light">
            All Terrain Tree Service
          </p>
        </div>

        {/* Animated Spinner - CSS animation */}
        <div
          className="w-12 h-12 border-4 border-white/20 border-t-green-500 rounded-full animate-spin"
        />

        {/* Loading Dots - CSS animation with staggered delays */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-2 h-2 bg-green-600 rounded-full animate-dot-pulse"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* CSS Keyframes embedded via style tag for the custom animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        
        @keyframes logo-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-in-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.8s ease-out 0.2s both;
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        
        .animate-logo-pulse {
          animation: logo-pulse 2s ease-in-out infinite;
        }
        
        .animate-dot-pulse {
          animation: dot-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
