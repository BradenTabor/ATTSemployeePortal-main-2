import { memo } from "react";
import logo from "@/assets/atts-logo.webp";
import { Z } from "@/lib/zIndex";

interface LoadingScreenProps {
  message?: string;
}

/** Shares the inline boot styles in index.html to keep the first paint and React handoff stable. */
function LoadingScreenComponent({ message = "Opening your portal…" }: LoadingScreenProps) {
  return (
    <div className="boot" style={{ zIndex: Z.modal }}>
      <div className="boot-content">
        <div className="boot-tile">
          <img className="boot-logo" src={logo} alt="ATTS" width={64} height={64} />
        </div>
        <p className="boot-name">All Terrain</p>
        <p className="boot-sub">Tree Service · Employee Portal</p>
        <div className="boot-loading">
          <p className="boot-status" role="status" aria-live="polite">{message}</p>
          <div className="boot-track" aria-hidden="true" />
          <p className="boot-help">
            <span>Taking longer than usual.<br />If this continues, check your connection.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const LoadingScreen = memo(LoadingScreenComponent);
export default LoadingScreen;
