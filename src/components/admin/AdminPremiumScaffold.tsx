import { ReactNode } from "react";
import BrandedNavCard from "../BrandedNavCard";
import { cn } from "../../lib/utils";

export type AdminHeroBadge = {
  label: string;
  icon?: ReactNode;
  variant?: "solid" | "outline";
};

export type AdminHeroConfig = {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  heading: string;
  description?: string;
  badges?: AdminHeroBadge[];
};

export type AdminStat = {
  label: string;
  value: string;
  hint?: string;
};

export type AdminNavCardConfig = {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
};

interface AdminPremiumScaffoldProps {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  navCards?: AdminNavCardConfig[];
  sidePanel?: ReactNode;
  children?: ReactNode;
}

const BADGE_STYLES: Record<string, string> = {
  solid:
    "inline-flex items-center space-x-2 px-4 py-2 bg-black/40 rounded-full border border-[#f7dca8]/40 text-sm text-[#fff5da]",
  outline:
    "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#fef3d1]/30 text-sm text-[#f8e4bb] bg-[#fef3d1]/10",
};

export default function AdminPremiumScaffold({
  hero,
  stats,
  navCards,
  sidePanel,
  children,
}: AdminPremiumScaffoldProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <AdminHero hero={hero} stats={stats} />

          {navCards && navCards.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2">
              {navCards.map((card) => (
                <BrandedNavCard
                  key={card.to}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  to={card.to}
                  variant="gold"
                />
              ))}
            </div>
          )}

          {children}
        </div>

        {sidePanel && (
          <div className="relative overflow-hidden rounded-3xl border border-[#f6dcb2]/25 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#070605] shadow-[0_40px_80px_rgba(0,0,0,0.65)] p-6">
            <div className="pointer-events-none absolute inset-0 rounded-3xl border border-[#f6dcb2]/10 opacity-40" />
            <div className="pointer-events-none absolute -top-24 -right-10 h-56 w-56 bg-[radial-gradient(circle,rgba(247,223,179,0.35),transparent_60%)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 bg-[radial-gradient(circle,rgba(209,152,57,0.35),transparent_70%)] blur-3xl" />
            <div className="relative space-y-6">{sidePanel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminHero({
  hero,
  stats,
}: {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1c1f] via-[#262224] to-[#0f0d09] border border-[#f4dab1]/20 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,238,197,0.4),transparent_55%)] opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.25),transparent_45%)]" />

      <div className="relative flex flex-col gap-6">
        {(hero.eyebrow || hero.eyebrowIcon) && (
          <p className="text-[#f7e7c3] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2">
            {hero.eyebrowIcon}
            {hero.eyebrow}
          </p>
        )}

        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            {hero.heading}
          </h2>
          {hero.description && (
            <p className="text-[#fdf4db]/80 mt-2 max-w-2xl">{hero.description}</p>
          )}
        </div>

        {hero.badges && hero.badges.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {hero.badges.map((badge, index) => (
              <div
                key={`${badge.label}-${index}`}
                className={cn(
                  BADGE_STYLES[badge.variant ?? "solid"],
                  badge.variant === "outline" && "text-[#f8e4bb]"
                )}
              >
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        )}

        {stats && stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-2xl border border-[#f6dcb2]/15 bg-[#0c0a08]/70 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#f6dcb2]/35"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-70" />
                <div className="pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#f5d38f]/15 blur-2xl" />
                <div className="relative space-y-1.5">
                  <p className="text-[0.6rem] uppercase tracking-[0.35em] text-[#f2d7a2]/70">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-black text-[#fff6dd] tracking-wide">
                    {stat.value}
                  </p>
                  {stat.hint && (
                    <p className="text-xs text-[#f8e5bb]/70">{stat.hint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

