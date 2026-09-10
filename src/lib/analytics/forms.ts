import { FIELD_ROLES, REQUIRED_FORMS, type RequiredForm } from './types';

export function isFieldRole(role: string | null | undefined): boolean {
  return FIELD_ROLES.includes(role as (typeof FIELD_ROLES)[number]);
}

export function normalizeFormType(form: unknown): RequiredForm | null {
  if (form == null) return null;
  const s = String(form).toLowerCase().trim();
  if (s === 'dvir') return 'dvir';
  if (s === 'equipment' || s === 'equipment_inspection' || s === 'equip') return 'equipment';
  if (s === 'jsa' || s === 'daily_jsa' || s === 'daily-jsa') return 'jsa';
  return null;
}

export function asFormArray(forms_completed: unknown): string[] {
  if (Array.isArray(forms_completed)) {
    return forms_completed.map((f) => (typeof f === 'string' ? f : String(f)));
  }
  if (forms_completed != null && typeof forms_completed === 'object') {
    return Object.values(forms_completed).map((f) => String(f));
  }
  return [];
}

export function uniqueRequiredForms(forms_completed: unknown): RequiredForm[] {
  const found = new Set<RequiredForm>();
  for (const raw of asFormArray(forms_completed)) {
    const key = normalizeFormType(raw);
    if (key) found.add(key);
  }
  return REQUIRED_FORMS.filter((form) => found.has(form));
}

export function completedFormCount(forms_completed: unknown): number {
  return uniqueRequiredForms(forms_completed).length;
}

export function isFullPacket(forms_completed: unknown): boolean {
  return completedFormCount(forms_completed) === REQUIRED_FORMS.length;
}

export function hasAnyForm(forms_completed: unknown): boolean {
  return completedFormCount(forms_completed) > 0;
}

export function emptyFormCounts(): Record<RequiredForm, number> {
  return { dvir: 0, equipment: 0, jsa: 0 };
}

export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
