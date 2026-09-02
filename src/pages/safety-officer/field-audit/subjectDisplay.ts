/**
 * Subject display helpers shared by the tray, the review panel and the receipt,
 * so a person or unit reads identically everywhere in the audit flow.
 */

import type { CrewMember } from "../../../types/jobs";
import {
  equipmentTypeLabel,
  type FieldAuditSubject,
} from "../fieldAuditConstants";

export interface SubjectDisplay {
  name: string;
  subtitle: string;
}

export function describeSubject(
  subject: FieldAuditSubject,
  profile: Pick<CrewMember, "full_name" | "email" | "role"> | undefined,
): SubjectDisplay {
  if (subject.subject_type === "person") {
    return {
      name: profile?.full_name || profile?.email || "Crew member",
      subtitle: profile?.role || "Person",
    };
  }
  return {
    name:
      equipmentTypeLabel(subject.equipment_type) +
      (subject.equipment_number ? ` · ${subject.equipment_number}` : ""),
    subtitle: subject.is_custom_equipment ? "Custom equipment" : "Equipment",
  };
}

/** `subject.id → display name` for readiness messages and the receipt. */
export function buildSubjectNameMap(
  subjects: ReadonlyArray<FieldAuditSubject>,
  profileById: ReadonlyMap<string, Pick<CrewMember, "full_name" | "email" | "role">>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of subjects) {
    const profile = s.person_id ? profileById.get(s.person_id) : undefined;
    out.set(s.id, describeSubject(s, profile).name);
  }
  return out;
}
