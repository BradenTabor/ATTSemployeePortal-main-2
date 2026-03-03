# Reference: Admin Page Template

File: `src/pages/admin/<PageName>.tsx`

```tsx
import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { logger } from "../../lib/logger";
import { TextEffect } from "../../components/ui/TextEffect";
import {
  Search, Shield, Sparkles, FileDown, Loader2,
  SortAsc, SortDesc, ArrowUpDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DataExporter, generateFilename } from "../../lib/exportUtils";
import type { ExportMetadata } from "../../lib/exportUtils";

// Import your data hook
// import { use<Entity>List } from "../../hooks/queries/use<Entity>";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = "created_at" | "status"; // add your sortable columns
type SortDirection = "asc" | "desc";

// ─── Component ────────────────────────────────────────────────────────────────

export default function <PageName>() {
  const { user, role: currentUserRole } = useAuth();

  // ── Role gate ──
  if (currentUserRole !== "admin") {
    return (
      <DashboardLayout title="<Page Title>">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // ── Sorting ──
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField]);

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // ── Data ──
  // const { data: rawData, isLoading, error } = use<Entity>List();
  // Replace with your actual data hook

  const filteredData = useMemo(() => {
    // Apply filters, search, sort here
    return []; // replace with actual filtering logic
  }, [debouncedSearch, statusFilter, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const pageData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ── Export ──
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const handleExport = useCallback(async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      // See references/export-pattern.md
      logger.info(`<PageName> exported as ${format}`, { userId: user?.id });
    } finally {
      setExporting(null);
    }
  }, [filteredData, user]);

  // ── Sortable header sub-component ──
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#f8e5bb]/70 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>{children}</span>
          {isActive ? (
            sortDirection === "asc" ? <SortAsc className="w-3.5 h-3.5 text-[#f4c979]" /> : <SortDesc className="w-3.5 h-3.5 text-[#f4c979]" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-[#f8e5bb]/30" />
          )}
        </div>
      </th>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="<Page Title>">
      <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 pb-24">

        {/* ── Premium Glass Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6 md:p-8"
            style={{
              background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
              backdropFilter: 'blur(24px) saturate(1.6)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">
                  Admin • Category
                </span>
              </motion.div>
            </div>
            <div className="flex items-center gap-4">
              <motion.div className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32]" />
              <div>
                <TextEffect as="h1" preset="blurSlide" className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                  Page Title
                </TextEffect>
                <p className="mt-1.5 text-xs sm:text-sm text-[#f8e5bb]/50">
                  Description of what this page shows.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Filters + Export ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#f8e5bb]/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#f8e5bb]/30 focus:outline-none focus:ring-1 focus:ring-[#f4c979]/40"
              />
            </div>
            {/* Add more filter dropdowns as needed */}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={!!exporting || filteredData.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-40"
            >
              <FileDown className="w-4 h-4" />
              {exporting === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : "CSV"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting || filteredData.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-40"
            >
              <FileDown className="w-4 h-4" />
              {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:block rounded-2xl border border-[#f6dcb2]/15 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#2b251b] to-[#1b1812] border-b border-[#f6dcb2]/15">
                <tr>
                  <SortableHeader field="created_at">Date</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  {/* Add more columns */}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pageData.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-5 text-sm text-white">{/* cell content */}</td>
                    <td className="px-6 py-5 text-sm text-white">{/* cell content */}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80 flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4">
            <span className="text-xs text-[#f8e5bb]/50">
              {filteredData.length > 0
                ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length}`
                : "No results"}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#f8e5bb]/70">{currentPage} / {totalPages || 1}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden space-y-3">
          {pageData.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-[#f6dcb2]/15 bg-[#0c0a08]/60 p-4 space-y-2"
            >
              {/* Mobile card content — show key fields */}
            </motion.div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
```

## Notes
- The glass header gradient values and gold colors must match exactly for visual consistency
- `TextEffect` from `@/components/ui/TextEffect` provides the animated heading — always use it
- Row animations use `delay: index * 0.03` for a subtle stagger — not too slow, not instant
- For multi-role pages, change the role gate to `!["admin", "safety_officer"].includes(currentUserRole)`
