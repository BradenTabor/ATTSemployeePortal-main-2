# Reference: CSV/PDF Export Pattern

## Setup

```typescript
import { DataExporter, generateFilename } from "../../lib/exportUtils";
import type { ExportMetadata, ExportColumn } from "../../lib/exportUtils";
```

## Column Definitions

Use `ExportColumn<T>` with `key` + optional `format` (and optional `width` / `includeInPdf`).
**Do not** use an `accessor:` callback shape — that is stale and is not what `exportUtils.ts` implements.

```typescript
interface Row {
  date: string;
  employeeName: string;
  status: string;
}

// CSV columns (can include all fields)
const csvColumns: ExportColumn<Row>[] = [
  { header: "Date", key: "date", format: (v) => String(v ?? "—"), width: 14 },
  { header: "Employee", key: "employeeName", format: (v) => String(v ?? "—"), width: 22 },
  { header: "Status", key: "status", format: (v) => String(v ?? "—"), width: 12 },
];

// PDF columns (fewer columns — must fit page width)
const pdfColumns: ExportColumn<Row>[] = [
  { header: "Date", key: "date", format: (v) => String(v ?? "—"), width: 80 },
  { header: "Employee", key: "employeeName", format: (v) => String(v ?? "—"), width: 120 },
  { header: "Status", key: "status", format: (v) => String(v ?? "—"), width: 80 },
];
```

See also `ComplianceDataExportPanel.tsx` (`SectionConfig` with `columns` / `pdfColumns` / optional `previewColumns`) for the admin compliance export pattern, including `logReportExported` after each export.

## Export Handler

```typescript
const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

const handleExport = useCallback(async (format: "csv" | "pdf") => {
  setExporting(format);
  try {
    const exporter = new DataExporter<Row>();
    const metadata: ExportMetadata = {
      reportType: "Report Name",
      generatedAt: new Date(),
      exportedBy: user?.email || "admin",
      filters: {
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      },
      totalRecords: filteredData.length,
    };

    const filename = generateFilename("Report_Prefix", "date_context", format);

    if (format === "csv") {
      exporter.exportCSV({
        data: filteredData,
        columns: csvColumns,
        filename,
        metadata,
      });
    } else {
      await exporter.exportPDF({
        data: filteredData,
        columns: pdfColumns,
        filename,
        metadata,
        companyName: "All Terrain Tree Service",
        subtitle: "Report subtitle or date range",
        orientation: "landscape", // or "portrait" for narrow tables
      });
    }

    logger.info('Admin export completed', {
      format,
      recordCount: filteredData.length,
      userId: user?.id,
    });
  } catch (err) {
    logger.error('Admin export failed', { error: err, format });
  } finally {
    setExporting(null);
  }
}, [filteredData, user, debouncedSearch, statusFilter]);
```

## Notes
- `DataExporter` handles CSV download and PDF generation (uses jsPDF internally)
- `generateFilename` creates a timestamped filename: `Report_Prefix_date_context_2026-02-17.csv`
- PDF orientation: use `landscape` for tables with 5+ columns, `portrait` for narrow tables
- Always log the export event for the audit trail (`logReportExported` in compliance panel)
- Disable export buttons when `filteredData.length === 0`
