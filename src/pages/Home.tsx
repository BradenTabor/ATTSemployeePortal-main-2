import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNetworkStore } from "../lib/networkStatus";
import { logger } from "../lib/logger";
import { getRoleDashboard } from "../lib/navigation";
import { AuthShell } from "./home/AuthShell";
import { AuthBrandPanel } from "./home/AuthBrandPanel";
import { AuthForm } from "./home/AuthForm";
import { useAuthForm } from "./home/useAuthForm";
import { AUTH_HERO } from "./home/authCopy";

export default function Home() {
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const isDeviceOnline = useNetworkStore((s) => s.isOnline);
  const auth = useAuthForm();
  const hero = AUTH_HERO[auth.mode];

  // Redirect to the appropriate dashboard based on user role
  useEffect(() => {
    if (session) {
      const targetDashboard = getRoleDashboard(role);
      logger.info(`Session detected (role: ${role}), redirecting to ${targetDashboard}`);
      navigate(targetDashboard, { replace: true });
    }
  }, [session, role, navigate]);

  return (
    <AuthShell
      brand={<AuthBrandPanel title={hero.title} subtitle={hero.subtitle} />}
      footer={
        <p className="text-center text-[11px] text-white/25">
          Secure portal powered by Supabase
        </p>
      }
    >
      <AuthForm auth={auth} isDeviceOnline={isDeviceOnline} hasSession={!!session} />
    </AuthShell>
  );
}
