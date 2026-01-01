import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FileText, ClipboardList } from "lucide-react";

export default function FormsHistory() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="Forms History">
      <div className="max-w-4xl mx-auto space-y-6">
        <p className="text-sm text-gray-300">
          View the history of forms you&apos;ve submitted. Select a form type
          below to see your previous submissions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DVIR History Card */}
          <button
            onClick={() => navigate("/forms-history/dvir")}
            className="flex flex-col items-start rounded-2xl border border-green-700/40 bg-black/60 px-4 py-4 text-left hover:border-green-400/70 hover:bg-black/80 transition"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-green-400" />
              <h2 className="text-sm font-semibold text-white">
                Daily Vehicle Inspection (DVIR)
              </h2>
            </div>
            <p className="text-xs text-gray-300">
              Review your previously submitted DVIR forms, including photos and
              signatures.
            </p>
          </button>

          {/* Placeholder for future forms */}
          <div className="flex flex-col items-start rounded-2xl border border-gray-700/40 bg-black/40 px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-200">
                Other Forms (Coming Soon)
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              This space is reserved for future form history pages (RTO Requests,
              Incident Reports, etc.).
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
