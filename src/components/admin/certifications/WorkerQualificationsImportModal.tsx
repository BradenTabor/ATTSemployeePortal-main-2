import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { X } from "lucide-react";
import type {
  ElectricalQualificationLevel,
  WorkerQualification,
} from "../../../types/electricalQualification";
import { QUALIFICATION_LABELS } from "../../../types/electricalQualification";
import { toast } from "../../../lib/toast";
import { Z } from "@/lib/zIndex";

const LEVELS: ElectricalQualificationLevel[] = [
  "unqualified",
  "line_clearance_tree_trimmer",
  "qualified_269",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TEMPLATE_CSV = Papa.unparse([
  { worker_id: "00000000-0000-0000-0000-000000000000", new_level: "unqualified" },
]);

export interface ParsedRow {
  worker_id: string;
  new_level: string;
  rowIndex: number;
}

export interface ValidationError {
  rowIndex: number;
  message: string;
}

function validateRow(
  row: Record<string, string>,
  rowIndex: number
): ValidationError[] {
  const errs: ValidationError[] = [];
  const workerId = (row.worker_id ?? "").trim();
  const newLevel = (row.new_level ?? "").trim().toLowerCase();

  if (!workerId) {
    errs.push({ rowIndex, message: "worker_id is required" });
  } else if (!UUID_REGEX.test(workerId)) {
    errs.push({ rowIndex, message: "worker_id must be a valid UUID" });
  }

  if (!newLevel) {
    errs.push({ rowIndex, message: "new_level is required" });
  } else if (!LEVELS.includes(newLevel as ElectricalQualificationLevel)) {
    errs.push({
      rowIndex,
      message: `new_level must be one of: ${LEVELS.join(", ")}`,
    });
  }

  return errs;
}

function getLevelLabel(level: ElectricalQualificationLevel | string): string {
  return QUALIFICATION_LABELS[level as ElectricalQualificationLevel] ?? String(level);
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "worker-qualifications-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export interface WorkerQualificationsImportModalProps {
  open: boolean;
  onClose: () => void;
  workers: WorkerQualification[];
  onImport: (rows: { userId: string; level: ElectricalQualificationLevel }[]) => Promise<PromiseSettledResult<unknown>[]>;
}

export function WorkerQualificationsImportModal({
  open,
  onClose,
  workers,
  onImport,
}: WorkerQualificationsImportModalProps) {
  const [step, setStep] = useState<"file" | "validation" | "preview" | "results">("file");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<PromiseSettledResult<unknown>[] | null>(null);

  const workersById = useMemo(() => {
    const map: Record<string, WorkerQualification> = {};
    for (const w of workers) map[w.user_id] = w;
    return map;
  }, [workers]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length > 0) {
        toast.error(parsed.errors[0].message ?? "Failed to parse CSV.");
        return;
      }
      const data = parsed.data ?? [];
      const errs: ValidationError[] = [];
      const valid: ParsedRow[] = [];
      data.forEach((row, i) => {
        const rowNum = i + 2;
        const rowErrs = validateRow(row, rowNum);
        if (rowErrs.length > 0) {
          errs.push(...rowErrs);
        } else {
          valid.push({
            worker_id: (row.worker_id ?? "").trim(),
            new_level: (row.new_level ?? "").trim().toLowerCase() as ElectricalQualificationLevel,
            rowIndex: rowNum,
          });
        }
      });
      setValidationErrors(errs);
      setValidRows(valid);
      setStep(errs.length > 0 ? "validation" : "preview");
      if (errs.length === 0 && valid.length === 0) {
        toast.error("No valid rows in CSV.");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setStep("results");
    const settled = await onImport(
      validRows.map((r) => ({ userId: r.worker_id, level: r.new_level as ElectricalQualificationLevel }))
    );
    setResults(settled);
  };

  const handleClose = () => {
    setStep("file");
    setValidationErrors([]);
    setValidRows([]);
    setResults(null);
    onClose();
  };

  const failedWithReason = useMemo(() => {
    if (!results) return [];
    return validRows
      .map((row, i) => ({ row, result: results[i] }))
      .filter(({ result }) => result?.status === "rejected");
  }, [results, validRows]);

  if (!open) return null;

  const successCount = results?.filter((r) => r.status === "fulfilled").length ?? 0;
  const failCount = results?.filter((r) => r.status === "rejected").length ?? 0;

  const content = (
    <div style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-csv-title"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="import-csv-title" className="text-lg font-semibold text-white">
            Import CSV
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-4">
          {step === "file" && (
            <>
              <p className="text-sm text-white/80">
                Expected format: <code className="rounded bg-white/10 px-1">worker_id</code>,{" "}
                <code className="rounded bg-white/10 px-1">new_level</code>
              </p>
              <p className="text-sm text-white/60">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-emerald-400 hover:underline"
                >
                  Download template
                </button>
              </p>
              <label className="block">
                <span className="sr-only">Select CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-white/80 file:mr-3 file:rounded file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1.5 file:text-emerald-300"
                />
              </label>
            </>
          )}

          {step === "validation" && (
            <>
              <p className="text-sm text-red-300 font-medium">
                Please fix the following errors:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-200/90">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    Row {err.rowIndex}: {err.message}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-white/60">
                {validRows.length > 0 ? (
                  <>
                    {validRows.length} row(s) are valid. Fix errors and re-upload, or{" "}
                    <button
                      type="button"
                      onClick={() => setStep("preview")}
                      className="text-emerald-400 hover:underline"
                    >
                      continue with valid rows only
                    </button>
                    .
                  </>
                ) : (
                  "No valid rows. Fix errors and re-upload."
                )}
              </p>
              <button
                type="button"
                onClick={() => setStep("file")}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white"
              >
                Choose another file
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <p className="text-sm text-white/80">
                {validRows.length} row(s) will be updated:
              </p>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/60">
                      <th className="px-3 py-2 font-medium">Worker ID</th>
                      <th className="px-3 py-2 font-medium">Current level</th>
                      <th className="px-3 py-2 font-medium">New level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((r, i) => {
                      const worker = workersById[r.worker_id];
                      return (
                        <tr key={i} className="border-b border-white/5">
                          <td className="px-3 py-2 text-white/80 font-mono">
                            {r.worker_id.slice(0, 8)}…
                          </td>
                          <td className="px-3 py-2 text-white/70">
                            {worker
                              ? getLevelLabel(worker.electrical_qualification_level)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-white/70">
                            {getLevelLabel(r.new_level)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                >
                  Confirm import
                </button>
                <button
                  type="button"
                  onClick={() => setStep("file")}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === "results" && results !== null && (
            <>
              <p className="text-sm font-medium text-white">
                {successCount} updated successfully, {failCount} failed.
              </p>
              {failedWithReason.length > 0 && (
                <>
                  <p className="text-sm text-red-300">Failed rows:</p>
                  <ul className="list-disc list-inside text-sm text-red-200/90">
                    {failedWithReason.map(({ row: r, result }, i) => {
                      const reason =
                        result?.status === "rejected"
                          ? (result as PromiseRejectedResult).reason?.message ?? "Unknown error"
                          : null;
                      return (
                        <li key={i}>
                          Row {r.rowIndex}: {r.worker_id.slice(0, 8)}… → {r.new_level}
                          {reason && ` (${reason})`}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
