export interface ElectricalHazardData {
  voltage_kv: number;
  voltage_label: string;
  mad_phase_to_ground: string;
  mad_phase_to_phase: string;
  utility_company_contacted: boolean;
  utility_company_name: string;
  utility_contact_name: string;
  utility_confirmation_time: string;
  crew_qualifications_verified: boolean;
  crew_qualification_issues: string[];
  second_worker_required: boolean;
  second_worker_name: string;
  loto_required: boolean;
  loto_procedure_followed: boolean;
  loto_authorized_employee: string;
  /** Full LOTO data when loto_required is true */
  loto_data?: LOTOData | null;
}

export interface LOTOData {
  procedure_followed: boolean;
  lockout_device_applied: boolean;
  tagout_attached: boolean;
  zero_energy_verified: boolean;
  authorized_employee: string;
  lockout_datetime: string;
}
