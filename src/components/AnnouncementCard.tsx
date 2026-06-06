import { motion } from "framer-motion";
import attsLogo from "../assets/ATTS_Logo-removebg-preview.png";

interface AnnouncementCardProps {
  title: string;
  message: string;
  category: string;
  date: string;
  isNew?: boolean;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  title,
  message,
  category,
  date,
  isNew = false,
}) => (
  <motion.div
    transition={{ duration: 0.25, ease: "easeOut" }}
    className="relative overflow-hidden rounded-2xl border border-green-800/40 bg-gradient-to-br from-neutral-950/90 via-neutral-900/90 to-black/80 shadow-md hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] backdrop-blur-sm p-5 sm:p-6 transition-all duration-200 hover:scale-[1.02]"
  >
    <div className="absolute top-3 right-3 pointer-events-none">
      {isNew && (
        <span className="absolute inset-0 animate-ping rounded-full bg-green-500/30 scale-150 blur-md" />
      )}
      <img
        src={attsLogo}
        alt="ATTS Logo"
        loading="lazy"
        className="w-10 h-10 object-contain opacity-50"
      />
    </div>

    {isNew && (
      <span className="absolute top-3 left-3 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
        NEW
      </span>
    )}

    <div className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold text-green-400 leading-tight">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
        {message}
      </p>
      <div className="flex flex-wrap justify-between items-center pt-3 border-t border-green-800/30">
        <span className="inline-block text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-100/10 px-3 py-1 rounded-full">
          {category}
        </span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
    </div>
  </motion.div>
);
