/**
 * Centralized Export Utility
 * 
 * Provides professional, readable exports with proper formatting:
 * - CSV export with UTF-8 BOM for Excel compatibility
 * - Excel export with styled headers and metadata sheet
 * - PDF export with company header and page numbers
 * 
 * All data is formatted for end-user readability:
 * - Human-readable headers
 * - Formatted dates, currency, mileage
 * - Proper null handling
 * - Array/object flattening
 * 
 * PERFORMANCE: Heavy libraries (xlsx, jspdf) are dynamically imported
 * to reduce initial bundle size. Only loaded when exports are triggered.
 */

import { format } from 'date-fns';
import Papa from 'papaparse';

// Heavy libraries loaded on-demand via dynamic import
// xlsx (~200KB), jspdf (~150KB), jspdf-autotable (~50KB)
type XLSXModule = typeof import('xlsx');
type JsPDFModule = typeof import('jspdf');
type AutoTableModule = typeof import('jspdf-autotable');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Column definition for exports
 */
export interface ExportColumn<T> {
  /** Human-readable header name */
  header: string;
  /** Data key to extract value from */
  key: keyof T;
  /** Custom formatter function */
  format?: (value: unknown, row: T) => string;
  /** Column width for Excel (in characters) */
  width?: number;
}

/**
 * Export metadata for report headers
 */
export interface ExportMetadata {
  /** Report title/type */
  reportType: string;
  /** When the export was generated */
  generatedAt: Date;
  /** Email/name of user who exported */
  exportedBy: string;
  /** Filters applied to the data */
  filters: Record<string, string>;
  /** Total number of records */
  totalRecords: number;
}

/**
 * Export options
 */
export interface ExportOptions<T> {
  /** Data to export */
  data: T[];
  /** Column definitions */
  columns: ExportColumn<T>[];
  /** Filename (without extension) */
  filename: string;
  /** Optional metadata for report header */
  metadata?: ExportMetadata;
}

/**
 * PDF-specific options
 */
export interface PDFExportOptions<T> extends ExportOptions<T> {
  /** Company name for header */
  companyName?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

/**
 * Format a date for export
 * @param date - Date string or Date object
 * @param includeTime - Include time in output
 * @returns Formatted date string
 */
export function formatDateForExport(
  date: string | Date | null | undefined,
  includeTime = false
): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return includeTime
    ? format(d, "MMM dd, yyyy 'at' h:mm a")
    : format(d, 'MMM dd, yyyy');
}

/**
 * Format currency for export
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format mileage for export
 * @param miles - Mileage value
 * @returns Formatted mileage string
 */
export function formatMileage(miles: number | null | undefined): string {
  if (miles == null) return 'N/A';
  
  return `${miles.toLocaleString('en-US')} mi`;
}

/**
 * Format boolean for export
 * @param value - Boolean value
 * @param trueLabel - Label for true
 * @param falseLabel - Label for false
 * @returns Formatted boolean string
 */
export function formatBoolean(
  value: boolean | null | undefined,
  trueLabel = 'Yes',
  falseLabel = 'No'
): string {
  if (value == null) return 'N/A';
  return value ? trueLabel : falseLabel;
}

/**
 * Format a list of parts for export
 * @param parts - Array of parts with name and quantity
 * @returns Formatted parts string
 */
export function formatPartsList(
  parts: Array<{ part_name: string; quantity: number; part_number?: string }> | null | undefined
): string {
  if (!parts || parts.length === 0) return 'No parts used';
  
  return parts
    .map(p => {
      const partNum = p.part_number ? ` #${p.part_number}` : '';
      return `${p.part_name}${partNum} (qty: ${p.quantity})`;
    })
    .join(', ');
}

/**
 * Format an array of strings for export
 * @param items - Array of strings
 * @param fallback - Fallback text if empty
 * @returns Formatted string
 */
export function formatStringArray(
  items: string[] | null | undefined,
  fallback = 'None'
): string {
  if (!items || items.length === 0) return fallback;
  return items.join(', ');
}

/**
 * Format any value with graceful null handling
 * @param value - Value to format
 * @param fallback - Fallback for null/undefined
 * @returns Formatted string
 */
export function formatValue(
  value: unknown,
  fallback = 'N/A'
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (value instanceof Date) {
    return formatDateForExport(value);
  }
  
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : fallback;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Escape a string for CSV (handles quotes and special characters)
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeCSV(str: string | null | undefined): string {
  if (!str) return '';
  const escaped = str.replace(/"/g, '""');
  return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
    ? `"${escaped}"`
    : escaped;
}

// =============================================================================
// FILENAME GENERATOR
// =============================================================================

/**
 * Generate a professional filename for export
 * @param reportType - Type of report
 * @param context - Additional context (e.g., truck number, date range)
 * @param extension - File extension
 * @returns Generated filename
 */
export function generateFilename(
  reportType: string,
  context?: string,
  extension = 'csv'
): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
  
  const parts = [sanitize(reportType)];
  if (context) {
    parts.push(sanitize(context));
  }
  parts.push(timestamp);
  
  return `${parts.join('_')}.${extension}`;
}

// =============================================================================
// METADATA HEADER GENERATOR
// =============================================================================

/**
 * Generate a metadata header string for text-based exports
 * @param metadata - Export metadata
 * @returns Formatted header string
 */
export function generateMetadataHeader(metadata: ExportMetadata): string {
  const filterStr = Object.entries(metadata.filters)
    .filter(([, v]) => v && v !== 'all' && v !== 'All')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'None';
  
  return `
${metadata.reportType}
Generated: ${format(metadata.generatedAt, 'MMMM dd, yyyy \'at\' h:mm a')}
Exported By: ${metadata.exportedBy}
Filters Applied: ${filterStr}
Total Records: ${metadata.totalRecords}
`.trim();
}

// =============================================================================
// DATA EXPORTER CLASS
// =============================================================================

/**
 * Main data exporter class
 */
export class DataExporter<T = Record<string, unknown>> {
  /**
   * Transform data using column definitions
   */
  private transformData(
    data: T[],
    columns: ExportColumn<T>[]
  ): Record<string, string>[] {
    return data.map(row => {
      const formatted: Record<string, string> = {};
      
      columns.forEach(col => {
        const rawValue = row[col.key];
        formatted[col.header] = col.format
          ? col.format(rawValue, row)
          : formatValue(rawValue);
      });
      
      return formatted;
    });
  }
  
  /**
   * Download a blob as a file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Export to CSV with UTF-8 BOM for Excel compatibility
   */
  exportCSV(options: ExportOptions<T>): void {
    const { data, columns, filename, metadata } = options;
    const transformed = this.transformData(data, columns);
    
    // Generate CSV content using PapaParse
    const csv = Papa.unparse(transformed, {
      quotes: true,
      delimiter: ',',
      header: true,
      newline: '\r\n', // Windows-compatible
    });
    
    // Build final content with optional metadata header
    let content = '';
    if (metadata) {
      content += generateMetadataHeader(metadata) + '\n\n';
    }
    content += csv;
    
    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\ufeff' + content], {
      type: 'text/csv;charset=utf-8;',
    });
    
    this.downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  }
  
  /**
   * Export to Excel with styling and metadata sheet
   * Uses dynamic import to avoid bundling xlsx (~200KB) in main bundle
   */
  async exportExcel(options: ExportOptions<T>): Promise<void> {
    const { data, columns, filename, metadata } = options;
    const transformed = this.transformData(data, columns);
    
    // Dynamically import xlsx for code splitting
    const XLSX: XLSXModule = await import('xlsx');
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add metadata sheet if provided
    if (metadata) {
      const infoData = [
        ['Export Information', ''],
        ['', ''],
        ['Report Type', metadata.reportType],
        ['Generated', format(metadata.generatedAt, 'MMMM dd, yyyy \'at\' h:mm a')],
        ['Exported By', metadata.exportedBy],
        ['Total Records', metadata.totalRecords.toString()],
        ['', ''],
        ['Filters Applied', ''],
        ...Object.entries(metadata.filters)
          .filter(([, v]) => v && v !== 'all' && v !== 'All')
          .map(([k, v]) => [k, String(v)]),
      ];
      const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
      
      // Set column widths for info sheet
      infoSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
      
      XLSX.utils.book_append_sheet(wb, infoSheet, 'Export Info');
    }
    
    // Add data sheet
    const dataSheet = XLSX.utils.json_to_sheet(transformed);
    
    // Set column widths
    const colWidths = columns.map(col => ({
      wch: col.width || Math.max(col.header.length, 15),
    }));
    dataSheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Data');
    
    // Write file
    const excelFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, excelFilename);
  }
  
  /**
   * Export to PDF with company header and auto-table
   * Uses dynamic import to avoid bundling jspdf (~150KB) and jspdf-autotable (~50KB) in main bundle
   */
  async exportPDF(options: PDFExportOptions<T>): Promise<void> {
    const {
      data,
      columns,
      filename,
      metadata,
      companyName = 'ATTS Fleet Management',
      subtitle,
      orientation = 'landscape',
    } = options;
    
    const transformed = this.transformData(data, columns);
    
    // Dynamically import jspdf and jspdf-autotable for code splitting
    const [jsPDFModule, autoTableModule]: [JsPDFModule, AutoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const jsPDF = jsPDFModule.default;
    const autoTable = autoTableModule.default;
    
    // Create PDF
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;
    
    // Company header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    // Report title
    if (metadata) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(metadata.reportType, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
    }
    
    // Subtitle
    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
      doc.setTextColor(0);
      yPos += 5;
    }
    
    // Metadata info
    if (metadata) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      const metaText = `Generated: ${format(metadata.generatedAt, 'MMM dd, yyyy h:mm a')} | Records: ${metadata.totalRecords}`;
      doc.text(metaText, pageWidth / 2, yPos, { align: 'center' });
      doc.setTextColor(0);
      yPos += 10;
    }
    
    // Table headers and body
    const headers = columns.map(col => col.header);
    const body = transformed.map(row => headers.map(h => row[h] || ''));
    
    // Placeholder for total page count - will be replaced after all pages render
    const totalPagesPlaceholder = '{total_pages}';
    
    // Auto-table
    autoTable(doc, {
      head: [headers],
      body,
      startY: yPos,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 10, right: 10 },
      didDrawPage: (pageData) => {
        // Footer with page numbers using placeholder for total
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${pageData.pageNumber} of ${totalPagesPlaceholder}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        
        // Export date in footer
        if (metadata) {
          doc.text(
            `Exported by: ${metadata.exportedBy}`,
            10,
            doc.internal.pageSize.getHeight() - 10
          );
        }
      },
    });
    
    // Replace placeholder with actual total page count after all pages are rendered
    doc.putTotalPages(totalPagesPlaceholder);
    
    // Save
    const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    doc.save(pdfFilename);
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick CSV export
 */
export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  metadata?: ExportMetadata
): void {
  const exporter = new DataExporter<T>();
  exporter.exportCSV({ data, columns, filename, metadata });
}

/**
 * Quick Excel export (async - loads xlsx on demand)
 */
export async function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  metadata?: ExportMetadata
): Promise<void> {
  const exporter = new DataExporter<T>();
  await exporter.exportExcel({ data, columns, filename, metadata });
}

/**
 * Quick PDF export (async - loads jspdf on demand)
 */
export async function exportToPDF<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  metadata?: ExportMetadata,
  options?: Partial<PDFExportOptions<T>>
): Promise<void> {
  const exporter = new DataExporter<T>();
  await exporter.exportPDF({ data, columns, filename, metadata, ...options });
}

// =============================================================================
// PREBUILT COLUMN DEFINITIONS
// =============================================================================

/**
 * Common column formatter for dates
 */
export const dateColumn = <T>(
  key: keyof T,
  header: string,
  includeTime = false
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatDateForExport(value as string | Date | null, includeTime),
  width: includeTime ? 22 : 14,
});

/**
 * Common column formatter for currency
 */
export const currencyColumn = <T>(
  key: keyof T,
  header: string
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatCurrency(value as number | null),
  width: 12,
});

/**
 * Common column formatter for mileage
 */
export const mileageColumn = <T>(
  key: keyof T,
  header: string
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatMileage(value as number | null),
  width: 12,
});

/**
 * Common column formatter for booleans
 */
export const booleanColumn = <T>(
  key: keyof T,
  header: string,
  trueLabel = 'Yes',
  falseLabel = 'No'
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatBoolean(value as boolean | null, trueLabel, falseLabel),
  width: 8,
});

/**
 * Common column formatter for arrays
 */
export const arrayColumn = <T>(
  key: keyof T,
  header: string,
  fallback = 'None'
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatStringArray(value as string[] | null, fallback),
  width: 30,
});

/**
 * Common column formatter for parts lists
 */
export const partsColumn = <T>(
  key: keyof T,
  header: string
): ExportColumn<T> => ({
  header,
  key,
  format: (value) =>
    formatPartsList(
      value as Array<{ part_name: string; quantity: number; part_number?: string }> | null
    ),
  width: 40,
});

/**
 * Simple text column with fallback
 */
export const textColumn = <T>(
  key: keyof T,
  header: string,
  fallback = 'N/A',
  width = 15
): ExportColumn<T> => ({
  header,
  key,
  format: (value) => formatValue(value, fallback),
  width,
});
