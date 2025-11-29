import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { Wrench, ClipboardList, AlertTriangle } from "lucide-react";

export default function MechanicDashboard() {
  const { role } = useAuth();

  // Optional simple guard (extra safety on top of ProtectedRoute)
  if (role && role !== "mechanic" && role !== "admin") {
    return (
      <DashboardLayout title="Mechanic Panel">
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view the mechanic panel.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mechanic Panel">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Mechanic Control Center
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Review DVIRs, track failed inspections, and record repairs. More
            mechanic tools will be added here over time.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* DVIR Center main nav card */}
          <Link
            to="/mechanic-dvir-center"
            className="
              group relative flex flex-col justify-between
              rounded-2xl border border-emerald-600/40 bg-black/60
              px-4 py-4
              shadow-[0_0_0_0_rgba(16,185,129,0.0)]
              transition-all duration-200
              hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.28)]
              hover:-translate-y-0.5
              active:translate-y-0
              active:scale-95
            "
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                  <ClipboardList className="w-3 h-3" />
                  DVIR Queue & Updates
                </div>
                <h2 className="text-sm font-semibold text-white mt-1">
                  DVIR Review & Mechanic Updates
                </h2>
                <p className="text-[11px] text-gray-400">
                  See all driver-submitted DVIRs, grouped by passed and failed.
                  Open one at a time, view failed items, and log what&apos;s been
                  fixed.
                </p>
              </div>
              <AlertTriangle className="w-6 h-6 text-yellow-400/80 group-hover:text-yellow-300 transition-colors" />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
              <span className="group-hover:text-emerald-300 transition-colors">
                Open DVIR Center
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-300 group-hover:translate-x-0.5 transition-transform">
                View queue
                <span className="text-xs">↗</span>
              </span>
            </div>
          </Link>

          {/* Placeholder cards for future expansion */}
          <div className="rounded-2xl border border-gray-700 bg-black/50 px-4 py-4 text-xs text-gray-400 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">
                Upcoming: PM Schedule
              </h2>
              <p>
                Reserved for preventive maintenance scheduling, due dates, and
                service reminders.
              </p>
            </div>
            <span className="mt-3 text-[10px] text-gray-500">
              Coming soon
            </span>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-black/50 px-4 py-4 text-xs text-gray-400 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">
                Upcoming: Parts & Repairs Log
              </h2>
              <p>
                Track parts used, repeat issues, and repair history by truck or
                trailer number.
              </p>
            </div>
            <span className="mt-3 text-[10px] text-gray-500">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
