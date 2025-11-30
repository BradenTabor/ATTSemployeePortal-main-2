import { useCallback, memo, useMemo } from "react";
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
import DashboardAnnouncementCard from "../components/DashboardAnnouncementCard";
import GreetingHeader from "../components/GreetingHeader";
import NavCards from "../components/NavCards";
import { useAuth } from "../contexts/AuthContext";
import AdaptiveCardWrapper from "../components/AdaptiveCardWrapper";
import { cn } from "../lib/utils";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";


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
  gradient: "from-[#1b5f43]/70 via-[#04130d] to-[#010604]",
  border: "border-[#2a8a63]/40",
  glow: "from-[#33c38a]/20 to-transparent",
  iconBg: "bg-[#1c7a57]/30 border border-[#2e9b6e]/40",
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
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  iconBg
                )}
              >
                <Icon className={cn("w-5 h-5", iconAccent)} />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-lg mb-1">
                  {link.label}
                </p>
                <p className="text-sm text-white/70 leading-relaxed">
                  {link.description}
                </p>
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
  const displayName = user?.email?.split("@")[0] ?? "Employee";

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  const quickLinks: QuickLink[] = useMemo(
    () => [
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
              description:
                "Approve or deny employee time-off requests in one place.",
              icon: Calendar,
              path: "/admin/rto",
              gradient:
                "from-[#f6b96b]/70 via-black/80 to-[#37240d] hover:from-[#fccc7b]",
              border: "border-[#f6b96b]/40",
              glow: "from-[#f5c982]/18 to-transparent",
              iconBg: "bg-[#f6b96b]/15 border border-[#f6b96b]/40",
              iconAccent: "text-[#ffd9a6]",
            },
            {
              label: "Manage App Users",
              description: "Update user roles, permissions, and onboarding.",
              icon: Shield,
              path: "/admin/users",
              gradient:
                "from-[#f7e4bd]/70 via-black/80 to-[#3a250f] hover:from-[#f7e4bd]",
              border: "border-[#f7e4bd]/35",
              glow: "from-[#ffe6c3]/18 to-transparent",
              iconBg: "bg-[#f7e4bd]/10 border border-[#f4c979]/35",
              iconAccent: "text-[#f4c979]",
            },
          ]
        : []),
      ...(hasMechanicAccess
        ? [
            {
              label: "DVIR ControlCenter",
              description: "Inspect DVIR submissions and coordinate repairs.",
              icon: Wrench,
              path: "/mechanic-dvir-center",
              gradient:
                "from-[#ff8f5b]/70 via-black/80 to-[#3d1a0c] hover:from-[#ff9f6f]",
              border: "border-[#ff9f6f]/35",
              glow: "from-[#ff925d]/18 to-transparent",
              iconBg: "bg-[#ff9350]/10 border border-[#ff9350]/35",
              iconAccent: "text-[#ffb48a]",
            },
          ]
        : []),
    ],
    [isAdmin, hasMechanicAccess]
  );

  const heroStats = useMemo<AdminStat[]>(() => {
    const localTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return [
      {
        label: "Portal Status",
        value: "ACTIVE",
        hint: "Secure session",
      },
      {
        label: "Quick Links",
        value: quickLinks.length.toString().padStart(2, "0"),
        hint: "Personalized shortcuts",
      },
      {
        label: "Local Time",
        value: localTime,
        hint: "System clock",
      },
    ];
  }, [quickLinks.length]);

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Employee Command",
      eyebrowIcon: <Zap className="w-4 h-4 text-[#7ef2c8]" />,
      heading: `Welcome back, ${displayName}`,
      description:
        "Stay synced with forms, announcements, and role-specific panels—all from one launch surface.",
      badges: [
        {
          label: (role ?? "Employee").toUpperCase(),
          icon: <Shield className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "solid",
        },
        {
          label: `${quickLinks.length} quick links`,
          icon: <FileText className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "outline",
        },
      ],
    }),
    [displayName, quickLinks.length, role]
  );

  const sidePanelContent = (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
              Profile Snapshot
            </p>
            <p className="text-lg font-semibold text-white mt-2">
              {user?.email}
            </p>
            <p className="text-sm text-white/60 capitalize">{role}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-full bg-red-600/80 px-3 py-2 text-xs font-semibold border border-red-500/40"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#041b14]/80 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-emerald-300" />
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
            Latest News
          </p>
        </div>
        <DashboardAnnouncementCard />
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Employee Hub">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        theme="emerald"
        sidePanel={sidePanelContent}
      >
        <div className="w-full space-y-10">
          <section className="rounded-3xl border border-[#1f5f46]/40 bg-[#03150f]/85 p-6 text-white space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
                  Pulse Check
                </p>
                <GreetingHeader />
              </div>
              <div className="text-sm text-white/70">
                Need help? Reach out via{" "}
                <Link
                  to="/contact"
                  className="text-emerald-300 underline-offset-4 hover:underline"
                >
                  Contact
                </Link>
                .
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Activity,
                  label: "Status",
                  value: "Active",
                  accent: "text-emerald-300",
                },
                {
                  icon: Zap,
                  label: "Shortcuts",
                  value: `${quickLinks.length} links`,
                  accent: "text-amber-300",
                },
                {
                  icon: Clock,
                  label: "Current Time",
                  value: heroStats[2].value,
                  accent: "text-cyan-300",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5/10 px-4 py-4 backdrop-blur-lg"
                >
                  <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
                    <item.icon className={cn("w-4 h-4", item.accent)} />
                    {item.label}
                  </div>
                  <p className="text-lg font-semibold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#1f5f46]/40 bg-[#04150f]/85 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-300" />
                  Quick Actions
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Launch high-impact workflows in a single tap.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="text-sm text-emerald-300 hover:text-emerald-200 font-medium flex items-center gap-1 group"
                onClick={() =>
                  document
                    .getElementById("navigation")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                View all tools
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickLinks.map((link, idx) => (
                <QuickActionCard key={link.path} link={link} index={idx} />
              ))}
            </div>
          </section>

          <section
            id="navigation"
            className="rounded-3xl border border-[#1f5f46]/40 bg-[#04150f]/85 p-6 space-y-6"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-300" />
              <h3 className="text-lg font-bold text-white">
                All Tools & Features
              </h3>
            </div>
            <NavCards />
          </section>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

export default memo(Dashboard);
