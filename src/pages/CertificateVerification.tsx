/**
 * Public certificate verification at /verify/:code.
 * No auth; minimal layout. Looks up by verification_code via RPC.
 */

import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ShieldCheck, XCircle, AlertCircle } from "lucide-react";
import { useCertificateByVerificationCode } from "../hooks/queries/useCertificateByVerificationCode";

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string }) {
  const now = new Date();
  const exp = new Date(expiresAt);
  const isExpired = status === "expired" || status === "revoked" || exp < now;
  const isActive = status === "active" && exp >= now;

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/40">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Valid
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-sm font-medium text-red-300 ring-1 ring-red-500/40">
        <XCircle className="h-4 w-4" aria-hidden />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-300 ring-1 ring-amber-500/40">
      <AlertCircle className="h-4 w-4" aria-hidden />
      {status}
    </span>
  );
}

export default function CertificateVerification() {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useCertificateByVerificationCode(code);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-xl">
        {isLoading && (
          <p className="text-center text-white/60">Verifying…</p>
        )}
        {error && (
          <p className="text-center text-red-400" role="alert">
            This certificate could not be verified.
          </p>
        )}
        {!isLoading && !error && !data && (
          <p className="text-center text-white/70">This certificate could not be verified.</p>
        )}
        {!isLoading && !error && data && (
          <div className="space-y-4">
            <div className="text-center">
              <StatusBadge status={data.status} expiresAt={data.expires_at} />
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-white/50">Name</dt>
                <dd className="font-medium text-white">
                  {data.full_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-white/50">Certification</dt>
                <dd className="font-medium text-white">{data.certification_name}</dd>
              </div>
              <div>
                <dt className="text-white/50">Passed</dt>
                <dd className="text-white/90">
                  {data.certified_at
                    ? format(new Date(data.certified_at), "PPP")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-white/50">Expires</dt>
                <dd className="text-white/90">
                  {data.expires_at ? format(new Date(data.expires_at), "PPP") : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-white/40">All Terrain Tree Service — Certificate verification</p>
    </div>
  );
}
