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
  "Daily Operations": {
    description: "Crew safety, inspections, and daily readiness workflows.",
    dot: "bg-emerald-400",
  },
  "People & HR": {
    description: "Employee requests, scheduling, and communication.",
    dot: "bg-sky-400",
  },
  "Finance & Procurement": {
    description: "Expense tracking, purchasing, and approvals.",
    dot: "bg-amber-400",
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
    category: "People & HR",
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

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.05,
      duration: 0.35,
      ease: "easeOut" as const,
    },
  }),
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.95,
    transition: { duration: 0.2, ease: "easeIn" as const },
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
        whileHover={{ y: -6, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative h-full rounded-2xl p-[2px] overflow-hidden shadow-[0_0_25px_8px_rgba(0,0,0,0.85)] transition-all duration-500 group"
        style={{
          background: "linear-gradient(135deg, rgba(28, 130, 93, 0.8) 0%, rgba(0, 0, 0, 0.8) 49%, rgba(52, 211, 153, 1) 100%)"
        }}
      >
        <div className="relative h-full rounded-[1.05rem] bg-black/35 border border-white/5 p-5 flex flex-col gap-5 backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 bg-sky-500/10 border-sky-400/40 text-sky-100 group-hover:rotate-3 group-hover:scale-105"
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white leading-tight">{form.title}</p>
                <p className="text-xs uppercase tracking-wide text-white/50">{form.category}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border bg-sky-500/10 border-sky-400/30 text-sky-100"
              >
                {isExternal ? "External" : "Internal"}
              </span>
              {form.tag && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                  {form.tag}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-white/70 leading-relaxed flex-1 overflow-hidden line-clamp-3">
            {form.description}
          </p>

          <div className="flex items-center justify-between text-xs text-white/60">
            <div className="flex items-center gap-2">
              {isExternal ? (
                <ExternalLink className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-300" />
              )}
              <span>
                {isExternal ? "Opens in a secure new tab" : "Completes inside the portal"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white">
              <span className="font-semibold text-sm">Open</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50">
            <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
            <span>{category}</span>
          </div>
          <p className="text-sm text-white/70 mt-1 max-w-2xl">{meta.description}</p>
        </div>
        <span className="text-xs text-white/50">{forms.length} forms</span>
      </div>
      <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
    <div className="flex flex-col gap-4">
      <label className="relative block group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none transition-colors group-focus-within:text-emerald-300" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by form name, purpose, or tag..."
          className="w-full rounded-2xl bg-black/50 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-transparent transition-all shadow-inner"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>
            Showing <span className="text-white font-semibold">{filteredCount}</span> of{" "}
            {totalCount} forms
          </span>
        </div>
        <span className="uppercase tracking-[0.4em] text-white/40">Live filters</span>
      </div>
    </div>
  </div>
);

interface CategoryFilterProps {
  activeCategory: CategoryFilterOption;
  onChange: (category: CategoryFilterOption) => void;
}

const CategoryFilter = ({ activeCategory, onChange }: CategoryFilterProps) => (
  <div className="flex gap-3 flex-wrap items-center justify-center pt-2">
    {CATEGORY_OPTIONS.map((category) => {
      const isActive = category === activeCategory;
      return (
        <motion.button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all backdrop-blur-md",
            isActive
              ? "bg-white text-slate-900 border-white shadow-lg shadow-emerald-500/20"
              : "bg-white/5 text-white/70 border-white/10 hover:border-white/30"
          )}
        >
          {category === "All" ? (
            <Sparkles className="w-4 h-4" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full", CATEGORY_META[category].dot)} />
          )}
          <span>{category === "All" ? "All Forms" : category}</span>
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
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="w-full"
  >
    <div className="border border-white/10 rounded-3xl bg-white/5 backdrop-blur-2xl p-8 text-center space-y-4 shadow-xl">
      <FileText className="w-10 h-10 text-white/50 mx-auto" />
      <h3 className="text-xl font-semibold text-white">No forms match your filters</h3>
      <p className="text-sm text-white/70">
        {query
          ? `We could not find anything for "${query}". Try clearing your search or picking another category.`
          : "Try choosing a different category or resetting your filters."}
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
        <div className="w-full space-y-6 md:space-y-8">
          {/* Search & Filters */}
          <div className="rounded-3xl border border-white/10 bg-[#03150f]/60 backdrop-blur-xl p-5 md:p-6 space-y-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              totalCount={formsCatalog.length}
              filteredCount={filteredForms.length}
            />
            <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
          </div>

          {/* Form Categories */}
          <div className="space-y-8">
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
