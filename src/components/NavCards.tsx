import { useAuth } from "../contexts/AuthContext";
import { FileText, Megaphone, Phone, Shield, FileSearch, Wrench } from "lucide-react";
import BrandedNavCard from "./BrandedNavCard";
import AdaptiveCardWrapper from "./AdaptiveCardWrapper";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

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
            icon={<Icon className="w-8 h-8" />}
            to={page.path}
          />
        );
      })}

      {/* Mechanic Dashboard Card (Orange Theme) */}
      {hasMechanicAccess && (
        <Link to="/mechanic-dashboard">
          <AdaptiveCardWrapper>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative w-full max-w-sm p-[2px] rounded-2xl overflow-hidden shadow-lg",
                "bg-gradient-to-br from-orange-600/70 via-black/80 to-orange-800/80",
                "hover:from-orange-500 hover:via-black hover:to-orange-700",
                "transition-all duration-300 ease-out"
              )}
            >
              <div
                className={cn(
                  "h-full w-full rounded-2xl p-6 flex flex-col justify-center items-center text-center",
                  "bg-black/70 backdrop-blur-xl",
                  "border border-orange-700/30"
                )}
              >
                <div className="mb-3 text-orange-400">
                  <Wrench className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-wide">
                  Mechanic Panel
                </h3>
                <p className="text-sm text-orange-100/80 max-w-xs">
                  Review and manage DVIR reports
                </p>
              </div>

              {/* Subtle glowing overlay */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-orange-500/10 to-transparent" />
            </motion.div>
          </AdaptiveCardWrapper>
        </Link>
      )}

      {/* Admin Dashboard Card (Gold Theme) */}
      {isAdmin && (
        <Link to="/admin">
          <AdaptiveCardWrapper>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative w-full max-w-sm p-[2px] rounded-2xl overflow-hidden shadow-lg",
                "bg-gradient-to-br from-yellow-600/70 via-black/80 to-yellow-800/80",
                "hover:from-yellow-500 hover:via-black hover:to-yellow-700",
                "transition-all duration-300 ease-out"
              )}
            >
              <div
                className={cn(
                  "h-full w-full rounded-2xl p-6 flex flex-col justify-center items-center text-center",
                  "bg-black/70 backdrop-blur-xl",
                  "border border-yellow-700/30"
                )}
              >
                <div className="mb-3 text-yellow-400">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-wide">
                  Admin Panel
                </h3>
                <p className="text-sm text-yellow-100/80 max-w-xs">
                  Manage users and system settings
                </p>
              </div>

              {/* Subtle glowing overlay */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-yellow-500/10 to-transparent" />
            </motion.div>
          </AdaptiveCardWrapper>
        </Link>
      )}
    </div>
  );
}
