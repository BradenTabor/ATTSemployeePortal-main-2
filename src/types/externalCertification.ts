export type ExternalCertCategory = 'external' | 'regulatory' | 'industry' | 'safety';

export interface ExternalCertificationType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: ExternalCertCategory;
  is_required: boolean;
  validity_months: number | null;
  reminder_days: number[];
  is_active: boolean;
  created_at: string;
}

export type ExternalCertStatus = 'active' | 'expired' | 'revoked' | 'pending_verification';

export interface WorkerExternalCertification {
  id: string;
  user_id: string;
  external_certification_type_id: string;
  status: ExternalCertStatus;
  effective_status: ExternalCertStatus;
  issued_date: string | null;
  expiration_date: string | null;
  issuing_authority: string | null;
  credential_number: string | null;
  document_url: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  granted_by: string | null;
  granted_at: string;
  cert_type_name?: string;
  worker_name?: string;
}

export const EXTERNAL_CERT_CATEGORY_LABELS: Record<ExternalCertCategory, string> = {
  external: 'External',
  regulatory: 'Regulatory',
  industry: 'Industry',
  safety: 'Safety',
};

export const EXTERNAL_CERT_STATUS_LABELS: Record<ExternalCertStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
  pending_verification: 'Pending Verification',
};
