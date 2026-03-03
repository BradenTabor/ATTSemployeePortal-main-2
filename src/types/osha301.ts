/**
 * OSHA Form 301 extended fields for incident logging.
 * These fields are mandatory for recordable incidents per OSHA 29 CFR 1904.
 */

export type EmployeeSex = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export interface OSHA301Demographics {
  employee_street_address: string | null;
  employee_city: string | null;
  employee_state: string | null;
  employee_zip: string | null;
  employee_date_of_birth: string | null;
  employee_sex: EmployeeSex | null;
  date_of_death: string | null;
  privacy_case: boolean;
}
