# Reference: CSV/PDF Export Pattern

## Setup

```typescript
import { DataExporter, generateFilename } from "../../lib/exportUtils";
import type { ExportMetadata } from "../../lib/exportUtils";
```

## Column Definitions

```typescript
// CSV columns (can include all fields)
const csvColumns = [
  { header: "Date", accessor: (item: DataType) => item.date },
  { header: "Employee", accessor: (item: DataType) => item.employeeName },
  { header: "Status", accessor: (item: DataType) => item.status },
  // ... all columns
];

// PDF columns (fewer columns — must fit page width)
const pdfColumns = [
  { header: "Date", accessor: (item: DataType) => item.date, width: 80 },
  { header: "Employee", accessor: (item: DataType) => item.employeeName, width: 120 },
  { header: "Status", accessor: (item: DataType) => item.status, width: 80 },
];
```

## Export Handler

```typescript
const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

const handleExport = useCallback(async (format: "csv" | "pdf") => {
  setExporting(format);
  try {
    const exporter = new DataExporter<DataType>();
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
- Always log the export event for the audit trail
- Disable export buttons when `filteredData.length === 0`
