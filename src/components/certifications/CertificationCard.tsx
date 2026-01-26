import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { CertificationType } from "../../types/certifications";
import type { CertificationRecord } from "../../types/certifications";
import attsLogoStamped from "../../assets/ATTS_Logo_stamped.png";

interface CertificationCardProps {
  cert: CertificationType;
  record?: CertificationRecord | null;
}

function getStatusLabel(status: string | null): { text: string; className: string } | null {
  if (!status) return null;
  switch (status) {
    case "active":
      return { text: "Active", className: "text-emerald-300 font-semibold" };
    case "expired":
      return { text: "Expired", className: "text-red-300 font-semibold" };
    case "pending":
    case "written_passed":
      return { text: "In progress", className: "text-amber-300 font-semibold" };
    case "revoked":
      return { text: "Revoked", className: "text-red-200/90 font-semibold" };
    case "renewed":
      return { text: "Renewed", className: "text-emerald-200 font-semibold" };
    default:
      return { text: status, className: "text-emerald-100/80 font-medium" };
  }
}

export function CertificationCard({ cert, record }: CertificationCardProps) {
  const status = record?.status ?? null;
  const statusLabel = getStatusLabel(status);

  return (
    <Link
      to={`/resources/certification/${cert.slug}/test`}
      className="group flex min-h-[44px] items-center justify-between gap-1.5 rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-2.5 sm:p-3 text-left shadow-md transition-all sm:gap-3 hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-950/50 hover:to-neutral-900/70 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <div className="flex shrink-0 items-center justify-center" aria-hidden>
          <img src={attsLogoStamped} alt="" className="h-8 w-8 object-contain sm:h-10 sm:w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white sm:text-sm">{cert.name}</p>
          <p className="text-[10px] sm:text-xs leading-tight text-emerald-100/80 font-medium">
            {cert.question_count ?? "—"} questions · {cert.passing_score}% to pass
            {record && statusLabel && (
              <span className="ml-1">
                · <span className={statusLabel.className}>{statusLabel.text}</span>
              </span>
            )}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300 transition-colors group-hover:text-emerald-200" aria-hidden />
    </Link>
  );
}
