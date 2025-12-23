import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileText,
  HardHat,
  Search,
  ShoppingCart,
  Sparkles,
  Wrench,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import AdaptiveCardWrapper from "../components/AdaptiveCardWrapper";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from "../components/admin/AdminPremiumScaffold";
import { cn } from "../lib/utils";

const CATEGORY_META = {
  "Finance & Procurement": {
    description: "Expense tracking, purchasing, and approvals.",
    dot: "bg-amber-400",
  },
  "HR": {
    description: "Employee requests, scheduling, and communication.",
    dot: "bg-sky-400",
  },
  "Daily Operations": {
    description: "Crew safety, inspections, and daily readiness workflows.",
    dot: "bg-emerald-400",
  },
  "Maintenance & Repairs": {
    description: "Fleet upkeep, shop coordination, and repair requests.",
    dot: "bg-orange-400",
  },
} as const;

type FormCategory = keyof typeof CATEGORY_META;
type CategoryFilterOption = "All" | FormCategory;

interface FormDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: FormCategory;
  type: "internal" | "external";
  to?: string;
  url?: string;
  tag?: string;
}

const formsCatalog: FormDefinition[] = [
  {
    id: "daily-jsa",
    title: "Daily JSA",
    description: "Create, update, and review daily job safety analysis forms.",
    icon: HardHat,
    category: "Daily Operations",
    type: "internal",
    to: "/forms/jsa",
    tag: "Daily",
  },
  {
    id: "dvir",
    title: "Daily Vehicle Inspection (DVIR)",
    description: "Complete required truck and trailer inspections before rolling out.",
    icon: ClipboardList,
    category: "Daily Operations",
    type: "internal",
    to: "/dashboard/forms/dvir",
    tag: "Compliance",
  },
  {
    id: "equipment-inspection",
    title: "Daily Equipment Inspection",
    description: "Document checks for bucket trucks, chippers, and field equipment.",
    icon: Wrench,
    category: "Daily Operations",
    type: "internal",
    to: "/dashboard/forms/equipment-inspection",
    tag: "Field Ops",
  },
  {
    id: "request-time-off",
    title: "Request Time Off",
    description: "Submit your time-off request for review and approval.",
    icon: CalendarDays,
    category: "HR",
    type: "internal",
    to: "/dashboard/forms/request-time-off",
    tag: "HR",
  },
  {
    id: "payroll-form",
    title: "Payroll Form",
    description: "Send payroll updates and adjustments securely.",
    icon: DollarSign,
    category: "Finance & Procurement",
    type: "external",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSctviPAy1rRfp351BJHBeazBBq1ukpztoGmxb1pwxk9J0CHww/viewform",
    tag: "Finance",
  },
  {
    id: "receipts-form",
    title: "Receipts Form",
    description: "Upload expense receipts.",
    icon: FileText,
    category: "Finance & Procurement",
    type: "external",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSeTwVhz3z3dOLE65MZ7_klz_W_R5da2gJo0JwEdkbZqspz5SQ/viewform",
    tag: "Receipts",
  },
  {
    id: "purchase-orders",
    title: "Purchase Orders (POs)",
    description: "Request purchase order approvals for materials or services.",
    icon: ShoppingCart,
    category: "Finance & Procurement",
    type: "external",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSe2GHpif_3F5NvekttjiAMR37Y9HvWchbnDDlj5VAoH1EqlzQ/viewform",
    tag: "Procurement",
  },
  {
    id: "mechanic-work-order",
    title: "Mechanic Work Order",
    description: "Request shop maintenance or repair follow-ups.",
    icon: Wrench,
    category: "Maintenance & Repairs",
    type: "external",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSczU3KNU4P3bO4zyfEqSfs6OWg7WPNbrYrmdyUMxvtLmrvVIw/viewform",
    tag: "Fleet",
  },
];

const CATEGORY_OPTIONS: CategoryFilterOption[] = [
  "All",
  ...(Object.keys(CATEGORY_META) as FormCategory[]),
];

// Reduced motion for better mobile performance
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: Math.min(index * 0.03, 0.15), // Cap delay for faster perceived loading
      duration: 0.25,
      ease: "easeOut" as const,
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
} as const;

interface FormCardProps {
  form: FormDefinition;
  index: number;
}

const FormCard = ({ form, index }: FormCardProps) => {
  const Icon = form.icon;
  const isExternal = form.type === "external";

  const cardContent = (
    <AdaptiveCardWrapper>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="relative h-full rounded-xl p-[1.5px] overflow-hidden shadow-[0_0_18px_6px_rgba(0,0,0,0.75)] transition-all duration-300 group touch-manipulation"
        style={{
          background: "linear-gradient(135deg, rgba(28, 130, 93, 0.8) 0%, rgba(0, 0, 0, 0.8) 49%, rgba(52, 211, 153, 1) 100%)"
        }}
      >
        <div className="relative h-full rounded-[0.65rem] bg-black/35 border border-white/5 px-3 sm:px-3.5 py-2.5 sm:py-3 flex flex-col gap-2 sm:gap-2.5 backdrop-blur-2xl min-h-[100px]">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0 flex items-center justify-center border transition-all duration-300 bg-sky-500/10 border-sky-400/40 text-sky-100"
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] sm:text-sm font-semibold text-white leading-tight truncate">{form.title}</p>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-white/50 truncate">{form.category}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span
                className="text-[8px] sm:text-[9px] uppercase tracking-wider sm:tracking-widest px-1.5 py-0.5 rounded-full border bg-sky-500/10 border-sky-400/30 text-sky-100"
              >
                {isExternal ? "Ext" : "Int"}
              </span>
              {form.tag && (
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                  {form.tag}
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed flex-1 overflow-hidden line-clamp-2">
            {form.description}
          </p>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-white/60 pt-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5">
              {isExternal ? (
                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              ) : (
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-300" />
              )}
              <span className="hidden xs:inline">
                {isExternal ? "New tab" : "In-portal"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white">
              <span className="font-semibold text-[11px] sm:text-xs">Open</span>
              <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-1" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-xl pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300" />
      </motion.div>
    </AdaptiveCardWrapper>
  );

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      className="h-full"
    >
      {isExternal ? (
        <a
          href={form.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full"
        >
          {cardContent}
        </a>
      ) : (
        <Link to={form.to ?? "/"} className="block h-full">
          {cardContent}
        </Link>
      )}
    </motion.div>
  );
};

interface FormCategorySectionProps {
  category: FormCategory;
  forms: FormDefinition[];
  startIndex: number;
}

const FormCategorySection = ({ category, forms, startIndex }: FormCategorySectionProps) => {
  const meta = CATEGORY_META[category];

  return (
    <section className="space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("h-2 w-2 rounded-full flex-shrink-0", meta.dot)} />
          <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/50 truncate">{category}</span>
        </div>
        <span className="text-[10px] sm:text-xs text-white/50 flex-shrink-0">{forms.length} form{forms.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-[11px] sm:text-sm text-white/60 sm:text-white/70 max-w-2xl leading-relaxed hidden sm:block">{meta.description}</p>
      <motion.div layout className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {forms.map((form, idx) => (
            <FormCard key={form.id} form={form} index={startIndex + idx} />
          ))}
        </AnimatePresence>
        </motion.div>
    </section>
  );
};

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

const SearchBar = ({ value, onChange, totalCount, filteredCount }: SearchBarProps) => (
  <div className="w-full">
    <div className="flex flex-col gap-3 sm:gap-4">
      <label className="relative block group">
        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none transition-colors group-focus-within:text-emerald-300" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search forms..."
          className="w-full rounded-xl sm:rounded-2xl bg-black/50 border border-white/10 pl-10 sm:pl-11 pr-3 sm:pr-4 py-3 min-h-[48px] text-base sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-transparent transition-all shadow-inner touch-manipulation"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-white/60">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
          <span>
            <span className="text-white font-semibold">{filteredCount}</span> of {totalCount} forms
          </span>
        </div>
        <span className="uppercase tracking-[0.25em] sm:tracking-[0.4em] text-white/40 hidden xs:inline">Live filters</span>
      </div>
    </div>
  </div>
);

interface CategoryFilterProps {
  activeCategory: CategoryFilterOption;
  onChange: (category: CategoryFilterOption) => void;
}

const CategoryFilter = ({ activeCategory, onChange }: CategoryFilterProps) => (
  <div className="flex gap-2 sm:gap-3 flex-wrap items-center justify-center pt-2">
    {CATEGORY_OPTIONS.map((category) => {
      const isActive = category === activeCategory;
      // Shorten labels for mobile
      const mobileLabel = category === "Finance & Procurement" ? "Finance" 
        : category === "Maintenance & Repairs" ? "Maintenance"
        : category === "Daily Operations" ? "Daily Ops"
        : category === "All" ? "All"
        : category;
      return (
        <motion.button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-full border text-xs sm:text-sm font-medium transition-all backdrop-blur-md touch-manipulation",
            isActive
              ? "bg-white text-slate-900 border-white shadow-lg shadow-emerald-500/20"
              : "bg-white/5 text-white/70 border-white/10 active:bg-white/10"
          )}
        >
          {category === "All" ? (
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", CATEGORY_META[category].dot)} />
          )}
          <span className="sm:hidden">{mobileLabel}</span>
          <span className="hidden sm:inline">{category === "All" ? "All Forms" : category}</span>
        </motion.button>
      );
    })}
  </div>
);

interface EmptyStateProps {
  query: string;
}

const EmptyState = ({ query }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="w-full"
  >
    <div className="border border-white/10 rounded-2xl sm:rounded-3xl bg-white/5 backdrop-blur-2xl p-5 sm:p-8 text-center space-y-3 sm:space-y-4 shadow-xl">
      <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white/50 mx-auto" />
      <h3 className="text-lg sm:text-xl font-semibold text-white">No forms found</h3>
      <p className="text-xs sm:text-sm text-white/70">
        {query
          ? `No results for "${query}". Try a different search.`
          : "Try a different category or clear filters."}
      </p>
    </div>
  </motion.div>
);

// Side panel components
const CategoryLegend = () => (
  <div className="space-y-3">
    {(Object.keys(CATEGORY_META) as FormCategory[]).map((category) => {
      const meta = CATEGORY_META[category];
      const formCount = formsCatalog.filter((f) => f.category === category).length;
      return (
        <div key={category} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", meta.dot)} />
            <span className="text-sm text-white/80 truncate">{category}</span>
          </div>
          <span className="text-xs text-emerald-400 font-semibold">{formCount}</span>
        </div>
      );
    })}
  </div>
);

export default function Forms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilterOption>("All");

  const filteredForms = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return formsCatalog.filter((form) => {
      const matchesCategory = activeCategory === "All" || form.category === activeCategory;
      const text = `${form.title} ${form.description} ${form.tag ?? ""}`.toLowerCase();
      const matchesSearch = !normalizedQuery || text.includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const sections = useMemo(() => {
    const targetCategories: FormCategory[] =
      activeCategory === "All"
        ? (Object.keys(CATEGORY_META) as FormCategory[])
        : [activeCategory];

    return targetCategories
      .map((category) => ({
        category,
        forms: filteredForms.filter((form) => form.category === category),
      }))
      .filter((section) => section.forms.length > 0);
  }, [activeCategory, filteredForms]);

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Company Forms",
      eyebrowIcon: <FileText className="w-4 h-4" />,
      heading: "Pick the Form you need and jump right in",
      description:
        "Organized categories, instant search, and easy access to every internal and external form.",
    }),
    []
  );

  // Side panel content
  const sidePanelContent = (
    <div className="space-y-6">
      {/* Category Legend */}
      <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-4 h-4 text-emerald-400" />
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
            Categories
          </p>
        </div>
        <CategoryLegend />
      </div>
    </div>
  );

  const trimmedQuery = searchQuery.trim();
  let cardCounter = 0;

  return (
    <DashboardLayout title="Company Forms">
      <AdminPremiumScaffold
        hero={heroConfig}
        theme="emerald"
        sidePanel={sidePanelContent}
      >
        <div className="w-full space-y-4 sm:space-y-6 md:space-y-8">
          {/* Search & Filters */}
          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#03150f]/60 backdrop-blur-xl p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              totalCount={formsCatalog.length}
              filteredCount={filteredForms.length}
            />
            <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
          </div>

          {/* Form Categories */}
          <div className="space-y-4 sm:space-y-5">
            {sections.length > 0 ? (
              sections.map(({ category, forms }) => {
                const section = (
                  <FormCategorySection
                    key={category}
                    category={category}
                    forms={forms}
                    startIndex={cardCounter}
                  />
                );
                cardCounter += forms.length;
                return section;
              })
            ) : (
              <EmptyState query={trimmedQuery} />
            )}
          </div>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
