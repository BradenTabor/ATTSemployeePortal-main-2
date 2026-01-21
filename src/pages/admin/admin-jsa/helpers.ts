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
// DATA EXTRACTION
// =============================================================================

export function getActiveLabels(
  map: Record<string, boolean> | null | undefined, 
  catalog: { key: string; label: string }[]
): string[] {
  if (!map) return [];
  return catalog.filter((item) => map[item.key]).map((item) => item.label);
}
