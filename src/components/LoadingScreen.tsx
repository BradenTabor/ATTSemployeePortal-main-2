import { memo } from "react";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

function LoadingScreenComponent() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #041b14 0%, #03120c 50%, #010604 100%)",
      }}
    >
      {/* Ambient radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "clamp(300px, 60vw, 600px)",
          height: "clamp(300px, 60vw, 600px)",
          background:
            "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)",
          animation: "loadingBreath 4s ease-in-out infinite",
        }}
      />

      {/* Floating particles — CSS only */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1.5 + (i % 3)}px`,
              height: `${1.5 + (i % 3)}px`,
              left: `${((i * 17 + 7) % 100)}%`,
              top: `${((i * 23 + 13) % 100)}%`,
              background: "#34d399",
              opacity: 0,
              animation: `loadingParticle ${2.5 + (i % 3) * 0.8}s ease-out infinite`,
              animationDelay: `${(i * 0.2) % 2.5}s`,
            }}
          />
        ))}
      </div>

      {/* Content card with glass effect */}
      <div
        className="relative flex flex-col items-center px-10 py-10 rounded-3xl opacity-0"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(16,185,129,0.08)",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)",
          animation: "loadingCardIn 0.6s cubic-bezier(0.4,0,0.2,1) 0.1s forwards",
        }}
      >
        {/* Logo with ring */}
        <div
          className="relative flex items-center justify-center mb-7"
          style={{ width: "140px", height: "140px" }}
        >
          {/* Breathing glow */}
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "180px",
              height: "180px",
              background:
                "radial-gradient(circle, rgba(16,185,129,0.2), rgba(5,150,105,0.1), transparent)",
              animation: "loadingBreath 3s ease-in-out infinite",
            }}
          />

          {/* Conic shimmer ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: "130px",
              height: "130px",
              background:
                "conic-gradient(from 0deg, transparent, rgba(52,211,153,0.25), transparent, rgba(110,231,183,0.2), transparent)",
              animation: "loadingRingSpin 4s linear infinite",
            }}
          />

          {/* Logo circle */}
          <div
            className="relative z-10 flex items-center justify-center rounded-full"
            style={{
              width: "110px",
              height: "110px",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
              border: "1px solid rgba(16,185,129,0.2)",
              boxShadow: "0 8px 32px rgba(5,150,105,0.15)",
              animation: "loadingLogoPulse 2s ease-in-out infinite",
            }}
          >
            <img
              src={logo}
              alt="ATTS Logo"
              className="w-20 h-20 object-contain"
              style={{
                filter: "drop-shadow(0 4px 12px rgba(16,185,129,0.3))",
              }}
            />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2 mb-6">
          <p
            className="text-lg font-semibold tracking-wide"
            style={{
              background: "linear-gradient(135deg, #ffffff, #6ee7b7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "loadingTextPulse 2s ease-in-out infinite",
            }}
          >
            Loading...
          </p>
          <p
            className="text-xs font-light tracking-[0.25em] uppercase"
            style={{ color: "rgba(110,231,183,0.55)" }}
          >
            All Terrain Tree Service
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-44 h-[3px] rounded-full overflow-hidden mb-5"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #047857, #10b981, #6ee7b7)",
              backgroundSize: "200% 100%",
              animation:
                "loadingProgress 2.5s ease-out infinite, loadingShimmer 1.5s linear infinite",
            }}
          />
        </div>

        {/* Orbital dots */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: "50px", height: "50px" }}
        >
          {/* Center glow dot */}
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: "#34d399",
              boxShadow: "0 0 10px #10b981, 0 0 20px rgba(52,211,153,0.4)",
              animation: "loadingCenterDot 1.5s ease-in-out infinite",
            }}
          />
          {/* Orbital dots */}
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, #6ee7b7, #10b981)",
                boxShadow:
                  "0 0 6px #34d399, 0 0 12px rgba(16,185,129,0.3)",
                transformOrigin: "center",
                animation: `loadingOrbit 2s linear infinite`,
                animationDelay: `${i * 0.4}s`,
                offsetPath: "path('M25,0 A25,25 0 1,1 24.99,0')",
                offsetRotate: "0deg",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom watermark */}
      <p
        className="absolute bottom-7 text-xs tracking-[0.3em] uppercase font-light"
        style={{
          color: "rgba(110,231,183,0.3)",
          animation: "loadingFadeUp 0.6s ease-out 0.8s forwards",
          opacity: 0,
        }}
      >
        Employee Portal
      </p>
    </div>
  );
}

const LoadingScreen = memo(LoadingScreenComponent);
export default LoadingScreen;
