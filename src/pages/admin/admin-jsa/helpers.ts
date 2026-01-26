/**
 * Helper/utility functions for AdminJSA page
 */

// =============================================================================
// DATE FORMATTING
// =============================================================================

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// =============================================================================
// PERSISTENCE (WF-019)
// =============================================================================

const ADMIN_JSA_STORAGE_KEY = "atts_admin_jsa_state";

export type PersistedAdminJSAState = {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  statusFilter?: "all" | "draft" | "completed";
  dateFilter?: string;
  dateEndFilter?: string;
  signatureFilter?: string;
  userFilter?: string;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  showFilters?: boolean;
};

export function persistAdminJSAState(state: PersistedAdminJSAState): void {
  try {
    localStorage.setItem(ADMIN_JSA_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy errors
  }
}

export function loadAdminJSAState(): PersistedAdminJSAState | null {
  try {
    const raw = localStorage.getItem(ADMIN_JSA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAdminJSAState;
  } catch {
    return null;
  }
}

// =============================================================================
// DATA EXTRACTION
// =============================================================================

export function getActiveLabels(
  map: Record<string, boolean> | null | undefined, 
  catalog: { key: string; label: string }[]
): string[] {
  if (!map) return [];
  return catalog.filter((item) => map[item.key]).map((item) => item.label);
}
