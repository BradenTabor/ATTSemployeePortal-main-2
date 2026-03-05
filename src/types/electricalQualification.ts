export type ElectricalQualificationLevel =
  | 'unqualified'
  | 'line_clearance_tree_trimmer'
  | 'qualified_269';

export interface WorkerQualification {
  user_id: string;
  full_name: string | null;
  role?: string | null;
  electrical_qualification_level: ElectricalQualificationLevel;
  electrical_qualification_date: string | null;
  electrical_qualification_verified_by: string | null;
  verified_by_name: string | null;
}

export const QUALIFICATION_LABELS: Record<ElectricalQualificationLevel, string> = {
  unqualified: 'Unqualified',
  line_clearance_tree_trimmer: 'Line-Clearance Tree Trimmer',
  qualified_269: 'Qualified (1910.269)',
};
