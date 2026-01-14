import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FileText, ClipboardList, ChevronRight } from "lucide-react";

export default function FormsHistory() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="Forms History">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4 sm:space-y-6">
        <p className="text-xs sm:text-sm text-gray-300">
          View the history of forms you&apos;ve submitted. Select a form type
          below to see your previous submissions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* DVIR History Card */}
          <button
            onClick={() => navigate("/forms-history/dvir")}
            className="flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-green-700/40 bg-black/60 px-3 sm:px-4 py-3 sm:py-4 text-left hover:border-green-400/70 hover:bg-black/80 active:bg-black/90 transition min-h-[72px] sm:min-h-[80px]"
          >
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 rounded-lg sm:rounded-xl bg-green-500/10 border border-green-500/30 flex-shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                  Daily Vehicle Inspection (DVIR)
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-2 mt-0.5">
                  Review your previously submitted DVIR forms
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-green-400/60 flex-shrink-0" />
          </button>

          {/* Placeholder for future forms */}
          <div className="flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-gray-700/40 bg-black/40 px-3 sm:px-4 py-3 sm:py-4 opacity-60 min-h-[72px] sm:min-h-[80px]">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 rounded-lg sm:rounded-xl bg-gray-500/10 border border-gray-500/30 flex-shrink-0">
                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-semibold text-gray-200 truncate">
                  Other Forms
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-2 mt-0.5">
                  Coming soon: RTO Requests, Incident Reports
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
