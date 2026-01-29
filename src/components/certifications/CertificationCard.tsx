import { ResourceCard } from "./ResourceCard";
import type { CertificationType } from "../../types/certifications";
import type { CertificationRecord } from "../../types/certifications";

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

  const subtitle = (
    <>
      {cert.question_count ?? "—"} questions · {cert.passing_score}% to pass
      {record && statusLabel && (
        <span className="ml-1">
          · <span className={statusLabel.className}>{statusLabel.text}</span>
        </span>
      )}
    </>
  );

  return (
    <ResourceCard
      to={`/resources/certification/${cert.slug}/test`}
      title={cert.name}
      subtitle={subtitle}
    />
  );
}
