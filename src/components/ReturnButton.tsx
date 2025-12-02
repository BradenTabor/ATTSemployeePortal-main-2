import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function ReturnButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const isAdmin = role === "admin";
  const path = location.pathname;

  let label = "";
  let target = "";

  if (!isAdmin) {
    if (path.startsWith("/") && path !== "/dashboard" && path !== "/") {
      label = "Return to Dashboard";
      target = "/dashboard";
    }
  } else {
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

  if (!label) return null;

  return (
    <div className="w-full flex justify-center mt-8">
      <button
        onClick={() => navigate(target)}
        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 px-6 py-3 text-sm font-semibold text-[#041b1a] shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_45px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{label}</span>
      </button>
    </div>
  );
}
