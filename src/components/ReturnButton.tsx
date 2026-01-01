import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function ReturnButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const isAdmin = role === "admin";
  const isGeneralForeman = role === "general_foreman";
  const isSafetyOfficer = role === "safety_officer";
  const isForeman = role === "foreman";
  const isMechanic = role === "mechanic";
  const path = location.pathname;

  let label = "";
  let target = "";

  // General Foreman role-specific navigation
  if (isGeneralForeman) {
    if (path !== "/general-foreman-dashboard" && path !== "/") {
      label = "Return to General Foreman Dashboard";
      target = "/general-foreman-dashboard";
    }
  }
  // Safety Officer role-specific navigation
  else if (isSafetyOfficer) {
    if (path !== "/safety-officer-dashboard" && path !== "/") {
      label = "Return to Safety Officer Dashboard";
      target = "/safety-officer-dashboard";
    }
  }
  // Mechanic role-specific navigation
  else if (isMechanic) {
    if (path !== "/mechanic-dashboard" && path !== "/") {
      label = "Return to Mechanic Dashboard";
      target = "/mechanic-dashboard";
    }
  }
  // Foreman role-specific navigation
  else if (isForeman) {
    if (path !== "/foreman-dashboard" && path !== "/") {
      label = "Return to Foreman Dashboard";
      target = "/foreman-dashboard";
    }
  }
  // Admin navigation (existing logic)
  else if (isAdmin) {
    if (path.startsWith("/admin") && path !== "/admin") {
      label = "Return to Admin Dashboard";
      target = "/admin";
    } else if (path === "/admin") {
      label = "Return to General Dashboard";
      target = "/dashboard";
    } else if (path.startsWith("/") && path !== "/dashboard" && path !== "/") {
      label = "Return to Dashboard";
      target = "/dashboard";
    }
  }
  // Default employee navigation (existing logic)
  else {
    if (path.startsWith("/") && path !== "/dashboard" && path !== "/") {
      label = "Return to Dashboard";
      target = "/dashboard";
    }
  }

  if (!label) return null;

  return (
    <div className="w-full flex justify-center mt-8">
      <button
        onClick={() => navigate(target)}
        className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_45px_rgba(0,0,0,0.45),0_6px_25px_20px_rgba(0,0,0,0.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
        style={{ 
          background: 'linear-gradient(90deg, rgba(52, 211, 153, 1) 0%, rgba(36, 137, 100, 1) 24%, rgba(20, 82, 59, 1) 51%, rgba(1, 35, 9, 1) 100%)',
          boxShadow: '0px 25px 45px 0px rgba(0, 0, 0, 0.45), 0px 6px 25px 20px rgba(0, 0, 0, 0.01), 0px 4px 10px 2px rgba(0, 0, 0, 0.85)'
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{label}</span>
      </button>
    </div>
  );
}
