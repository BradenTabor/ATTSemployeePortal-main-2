import DashboardLayout from "../layouts/DashboardLayout";
import BrandedNavCard from "../components/BrandedNavCard";
import AdaptiveCardWrapper from "../components/AdaptiveCardWrapper";
import {
  FileText,
  CalendarDays,
  DollarSign,
  Wrench,
  ShoppingCart,
  ExternalLink,
  ClipboardList, // ⬅️ NEW
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { ReactNode } from "react";

interface ExternalFormCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  url: string;
}

function ExternalFormCard({ title, description, icon, url }: ExternalFormCardProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <AdaptiveCardWrapper>
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "relative w-full max-w-sm p-[2px] rounded-2xl overflow-hidden shadow-lg",
            "bg-gradient-to-br from-green-600/70 via-black/80 to-green-800/80",
            "hover:from-green-500 hover:via-black hover:to-green-700",
            "transition-all duration-300 ease-out"
          )}
        >
          <div
            className={cn(
              "h-full w-full rounded-2xl p-6 flex flex-col justify-center items-center text-center",
              "bg-black/70 backdrop-blur-xl",
              "border border-green-700/30"
            )}
          >
            <div className="mb-3 text-green-400">{icon}</div>
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-wide">
              {title}
            </h3>
            <p className="text-sm text-white/80 max-w-xs mb-3">{description}</p>
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <ExternalLink className="w-3 h-3" />
              <span>Opens in new tab</span>
            </div>
          </div>

          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-green-500/10 to-transparent" />
        </motion.div>
      </AdaptiveCardWrapper>
    </a>
  );
}

export default function Forms() {
  return (
    <DashboardLayout title="Company Forms">
      {/* 🔔 Permanent "Important / Daily" toast */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wide text-yellow-200">
            Important / Daily
          </span>
        </div>
      </div>

      <p className="text-gray-300 text-base sm:text-lg mb-8 sm:mb-10 text-center">
        Select a form below to access
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-6xl mx-auto">
        {/* Existing cards */}
        <BrandedNavCard
          title="Request Time Off"
          description="Submit your time-off request for approval"
          icon={<CalendarDays className="w-8 h-8" />}
          to="/dashboard/forms/request-time-off"
        />

        <ExternalFormCard
          title="Payroll Form"
          description="Submit payroll information and updates"
          icon={<DollarSign className="w-8 h-8" />}
          url="https://docs.google.com/forms/d/e/1FAIpQLSdozbTMe9qO1OuLZvHKJBOH7BDMMOsB_-tua1FRo6YXc0C4Zw/viewform"
        />

        <ExternalFormCard
          title="Receipts Form"
          description="Upload and submit expense receipts"
          icon={<FileText className="w-8 h-8" />}
          url="https://docs.google.com/forms/d/e/1FAIpQLSdzpVGahh3Lautt3XBIBV-PSKJsfq2R5DY111N_KRO3RvJdIQ/viewform"
        />

        <ExternalFormCard
          title="Mechanic Work Order"
          description="Request vehicle maintenance and repairs"
          icon={<Wrench className="w-8 h-8" />}
          url="https://docs.google.com/forms/d/e/1FAIpQLSczU3KNU4P3bO4zyfEqSfs6OWg7WPNbrYrmdyUMxvtLmrvVIw/viewform"
        />

        <ExternalFormCard
          title="Purchase Orders (POs)"
          description="Submit purchase order requests"
          icon={<ShoppingCart className="w-8 h-8" />}
          url="https://docs.google.com/forms/d/e/1FAIpQLSe2GHpif_3F5NvekttjiAMR37Y9HvWchbnDDlj5VAoH1EqlzQ/viewform"
        />

        {/* NEW: DVIR internal form */}
        <BrandedNavCard
          title="Daily Vehicle Inspection (DVIR)"
          description="Complete required daily truck and trailer inspection"
          icon={<ClipboardList className="w-8 h-8" />}
          to="/dashboard/forms/dvir"
        />

        {/* NEW: Daily Equipment Inspection internal form */}
        <BrandedNavCard
          title="Daily Equipment Inspection"
          description="Document daily checks for equipment in the field"
          icon={<Wrench className="w-8 h-8" />}
          to="/dashboard/forms/equipment-inspection"
        />
      </div>
    </DashboardLayout>
  );
}
