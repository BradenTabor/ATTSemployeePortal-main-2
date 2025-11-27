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
        className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-700 to-green-900 hover:from-green-800 hover:to-green-950 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{label}</span>
      </button>
    </div>
  );
}
