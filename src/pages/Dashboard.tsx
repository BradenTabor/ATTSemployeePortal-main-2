import { useCallback, memo } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import {
 LogOut,
 Activity,
 Calendar,
 FileText,
 Megaphone,
 Clock,
 ChevronRight,
 Zap,
 Shield,
 Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AuroraBackground } from "../components/AuroraBackground";
import DashboardAnnouncementCard from "../components/DashboardAnnouncementCard";
import GreetingHeader from "../components/GreetingHeader";
import NavCards from "../components/NavCards";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/ATTS_Logo-removebg-preview.png";
import AdaptiveCardWrapper from "../components/AdaptiveCardWrapper";
import { cn } from "../lib/utils";


const container = {
 hidden: { opacity: 0 },
 show: {
   opacity: 1,
   transition: {
     staggerChildren: 0.1,
     delayChildren: 0.2,
   },
 },
};


const item = {
 hidden: { opacity: 0, y: 20 },
 show: { opacity: 1, y: 0 },
};

type QuickLink = {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
  gradient?: string;
  border?: string;
  glow?: string;
  iconBg?: string;
  iconAccent?: string;
};

const QUICK_CARD_DEFAULTS = {
  gradient: "from-emerald-600/70 via-black/80 to-emerald-800/80",
  border: "border-emerald-700/30",
  glow: "from-emerald-500/10 to-transparent",
  iconBg: "bg-emerald-500/10 border border-emerald-400/30",
  iconAccent: "text-emerald-200",
};

interface QuickActionCardProps {
  link: QuickLink;
  index: number;
}

const QuickActionCard = ({ link, index }: QuickActionCardProps) => {
  const Icon = link.icon;
  const gradient = link.gradient ?? QUICK_CARD_DEFAULTS.gradient;
  const border = link.border ?? QUICK_CARD_DEFAULTS.border;
  const glow = link.glow ?? QUICK_CARD_DEFAULTS.glow;
  const iconBg = link.iconBg ?? QUICK_CARD_DEFAULTS.iconBg;
  const iconAccent = link.iconAccent ?? QUICK_CARD_DEFAULTS.iconAccent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Link to={link.path} className="block h-full">
        <AdaptiveCardWrapper>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative w-full h-full p-[2px] rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br group",
              gradient
            )}
          >
            <div
              className={cn(
                "h-full w-full rounded-2xl p-5 flex flex-col gap-4 bg-black/70 backdrop-blur-xl border transition-all duration-300",
                border
              )}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconBg)}>
                <Icon className={cn("w-5 h-5", iconAccent)} />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-lg mb-1">{link.label}</p>
                <p className="text-sm text-white/70 leading-relaxed">{link.description}</p>
              </div>
              <div className="pt-2 flex items-center gap-2 text-xs text-white/60 group-hover:text-white transition-colors">
                Open
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div
              className={cn(
                "absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br",
                glow
              )}
            />
          </motion.div>
        </AdaptiveCardWrapper>
      </Link>
    </motion.div>
  );
};


function Dashboard() {
 const navigate = useNavigate();
 const { user, signOut, setSession, role, isAdmin, hasMechanicAccess } =
   useAuth();


 const handleSignOut = useCallback(async () => {
   try {
     setSession(null);
     await signOut();
     navigate("/", { replace: true });
   } catch (error) {
     console.error("Sign out failed:", error);
   }
 }, [navigate, setSession, signOut]);


 const quickLinks: QuickLink[] = [
   {
     label: "View Forms History",
     description: "Review, export, and reference previous submissions.",
     icon: FileText,
     path: "/forms-history",
   },
   ...(isAdmin
     ? [
         {
           label: "Manage RTO Requests",
           description: "Approve or deny employee time-off requests in one place.",
           icon: Calendar,
           path: "/admin/rto",
          gradient: "from-amber-600/80 via-black/80 to-amber-800/80",
          border: "border-amber-500/40",
          glow: "from-amber-400/15 to-transparent",
          iconBg: "bg-amber-500/10 border border-amber-400/30",
          iconAccent: "text-amber-200",
         },
         {
           label: "Manage App Users",
           description: "Update user roles, permissions, and onboarding access.",
           icon: Shield,
           path: "/admin/users",
           gradient: "from-yellow-600/70 via-black/80 to-yellow-800/80",
           border: "border-yellow-700/30",
           glow: "from-yellow-500/10 to-transparent",
           iconBg: "bg-yellow-500/10 border border-yellow-400/20",
           iconAccent: "text-yellow-200",
         },
       ]
     : []),
   ...(hasMechanicAccess
     ? [
         {
           label: "DVIR ControlCenter",
           description: "Inspect DVIR submissions and coordinate follow-up work.",
           icon: Wrench,
           path: "/mechanic-dvir-center",
           gradient: "from-orange-600/70 via-black/80 to-orange-800/80",
           border: "border-orange-700/30",
           glow: "from-orange-500/10 to-transparent",
           iconBg: "bg-orange-500/10 border border-orange-400/20",
           iconAccent: "text-orange-200",
         },
       ]
     : []),
 ];


 return (
   <AuroraBackground className="min-h-screen flex flex-col">
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       transition={{ duration: 0.8 }}
       className="w-full flex-1 flex flex-col"
     >
       <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
         {/* ===== TOP NAVIGATION BAR ===== */}
         <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
           className="flex items-center justify-between mb-12"
         >
           {/* Logo + Title */}
           <motion.div
             whileHover={{ scale: 1.05 }}
             className="flex items-center gap-3 cursor-pointer"
             onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
           >
             <div className="p-2 bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 rounded-xl border border-emerald-500/30">
               <img src={logo} alt="ATTS" className="w-20 h-24 object-contain" />
             </div>
             <div>
               <h1 className="text-2xl font-black text-white">ATTS</h1>
               <p className="text-xs text-emerald-400/80 font-semibold">
                 Employee Portal
               </p>
             </div>
           </motion.div>


           {/* Right section */}
           <div className="flex items-center gap-4">
             {/* User email (hidden on mobile) */}
             <div className="hidden sm:flex flex-col items-end">
               <p className="text-sm font-medium text-white">
                 {user?.email?.split("@")[0]}
               </p>
               <p className="text-xs text-gray-400 capitalize">{role}</p>
             </div>


             {/* Sign out button */}
             <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleSignOut}
               className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-700/80 text-white text-sm font-medium transition-all backdrop-blur-sm border border-red-500/40 group"
             >
               <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
               <span className="hidden sm:inline">Sign Out</span>
             </motion.button>
           </div>
         </motion.div>


         {/* ===== HERO SECTION ===== */}
         <motion.div
           variants={container}
           initial="hidden"
           animate="show"
           className="mb-12"
         >
           <motion.div variants={item} className="text-center mb-6">
             <h2 className="text-4xl sm:text-5xl font-black text-white mb-3 leading-tight">
               Welcome Back
             </h2>
             <GreetingHeader />
           </motion.div>


           {/* Quick stats bar */}
           <motion.div
             variants={item}
             className="grid grid-cols-3 gap-4 sm:gap-6"
           >
             <motion.div
               whileHover={{ y: -4 }}
               className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 hover:border-emerald-500/40 transition-all group"
             >
               <div className="flex items-center gap-2 mb-2">
                 <Activity className="w-4 h-4 text-emerald-400" />
                 <p className="text-xs text-gray-400 font-medium">Status</p>
               </div>
               <p className="text-lg font-bold text-white">Active</p>
             </motion.div>


             <motion.div
               whileHover={{ y: -4 }}
               className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 hover:border-emerald-500/40 transition-all group"
             >
               <div className="flex items-center gap-2 mb-2">
                 <Zap className="w-4 h-4 text-amber-400" />
                 <p className="text-xs text-gray-400 font-medium">Quick Access</p>
               </div>
               <p className="text-lg font-bold text-white">
                 {quickLinks.length}
               </p>
             </motion.div>


             <motion.div
               whileHover={{ y: -4 }}
               className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4 hover:border-emerald-500/40 transition-all group"
             >
               <div className="flex items-center gap-2 mb-2">
                 <Clock className="w-4 h-4 text-blue-400" />
                 <p className="text-xs text-gray-400 font-medium">Time</p>
               </div>
               <p className="text-lg font-bold text-white">
                 {new Date().toLocaleTimeString("en-US", {
                   hour: "2-digit",
                   minute: "2-digit",
                 })}
               </p>
             </motion.div>
           </motion.div>
         </motion.div>


         {/* ===== ANNOUNCEMENTS SECTION ===== */}
         <motion.div variants={item} initial="hidden" animate="show" className="mb-12">
           <div className="flex items-center gap-2 mb-4">
             <Megaphone className="w-5 h-5 text-emerald-400" />
             <h3 className="text-lg font-bold text-white">Latest News</h3>
           </div>
           <DashboardAnnouncementCard />
         </motion.div>


         {/* ===== QUICK ACTIONS SECTION ===== */}
         <motion.div variants={item} initial="hidden" animate="show" className="mb-12">
           <div className="flex items-center justify-between mb-6">
             <div>
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Zap className="w-5 h-5 text-amber-400" />
                 Quick Actions
               </h3>
               <p className="text-xs text-gray-400 mt-1">
                 Fast access to your most-used tools
               </p>
             </div>
             <motion.button
               whileHover={{ scale: 1.05 }}
               onClick={() =>
                 document
                   .getElementById("navigation")
                   ?.scrollIntoView({ behavior: "smooth" })
               }
               className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 group"
             >
               View All
               <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </motion.button>
           </div>


          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {quickLinks.map((link, idx) => (
              <QuickActionCard key={link.path} link={link} index={idx} />
            ))}
          </motion.div>
         </motion.div>


         {/* ===== NAVIGATION CARDS SECTION ===== */}
         <motion.div
           id="navigation"
           variants={item}
           initial="hidden"
           animate="show"
           className="mb-8"
         >
           <div className="flex items-center gap-2 mb-6">
             <FileText className="w-5 h-5 text-blue-400" />
             <h3 className="text-lg font-bold text-white">All Tools & Features</h3>
           </div>
           <NavCards />
         </motion.div>
       </div>
     </motion.div>
   </AuroraBackground>
 );
}


export default memo(Dashboard);

