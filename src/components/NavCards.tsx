import { useAuth } from "../contexts/AuthContext";
import {
  FileText,
  Megaphone,
  Phone,
  Shield,
  FileSearch,
  Wrench,
} from "lucide-react";
import BrandedNavCard from "./BrandedNavCard";

const userPages = [
  {
    label: "Company Forms",
    path: "/forms",
    icon: FileText,
    description: "Access and submit required ATTS forms"
  },
  {
    label: "Announcements",
    path: "/announcements",
    icon: Megaphone,
    description: "Latest company news and updates"
  },
  {
    label: "Resources",
    path: "/resources",
    icon: FileSearch,
    description: "Training materials and documents"
  },
  {
    label: "Contact",
    path: "/contact",
    icon: Phone,
    description: "Reach out to management and HR"
  },
];

export default function NavCards() {
  const { isAdmin, hasMechanicAccess } = useAuth();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 w-full max-w-6xl mx-auto">
      {userPages.map((page) => {
        const Icon = page.icon;
        return (
          <BrandedNavCard
            key={page.path}
            title={page.label}
            description={page.description}
            icon={<Icon className="w-8 h-8 text-emerald-200" />}
            to={page.path}
            variant="emerald"
          />
        );
      })}

      {hasMechanicAccess && (
        <BrandedNavCard
          title="Mechanic Panel"
          description="Review DVIR queues, failed inspections, and shop work."
          icon={<Wrench className="w-8 h-8 text-[#ffb48a]" />}
          to="/mechanic-dashboard"
          variant="ember"
        />
      )}

      {isAdmin && (
        <BrandedNavCard
          title="Admin Panel"
          description="Manage users, approvals, announcements, and more."
          icon={<Shield className="w-8 h-8 text-[#f4c979]" />}
          to="/admin"
          variant="gold"
        />
      )}
    </div>
  );
}
