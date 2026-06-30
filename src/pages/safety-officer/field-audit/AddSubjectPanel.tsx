/**
 * AddSubjectPanel — "Add Equipment" / "Add Person" controls for the subject tray.
 *
 * Equipment: type picker (human label → stored seed token, D2) → unit number
 * (from constants when known, free text otherwise), plus an "Other / new unit"
 * path that captures a free-text type + number flagged `is_custom_equipment`.
 * Person: crew roster first, then full profile search; person_id is the
 * app_users id (user_profiles.id), which is what field_audit_subjects references.
 */

import { useMemo, useState } from "react";
import { Wrench, User, Plus, Search, Loader2 } from "lucide-react";
import type { CrewMember } from "../../../types/jobs";
import {
  CUSTOM_EQUIPMENT_TOKEN,
  FIELD_AUDIT_EQUIPMENT_TYPES,
} from "../fieldAuditConstants";

const OTHER_UNIT = "__other_unit__";

const INPUT_CLASS =
  "w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40";

export interface AddEquipmentInput {
  equipmentType: string;
  equipmentNumber: string;
  isCustom: boolean;
}

interface AddSubjectPanelProps {
  crewMembers: CrewMember[];
  /** app_users ids that belong to the audit's crew (surfaced first). */
  crewRosterIds: Set<string>;
  /** app_users ids already added as person subjects (disabled in the picker). */
  existingPersonIds: Set<string>;
  busy?: boolean;
  /**
   * Require a unit number before equipment can be picked. Audit subjects allow a
   * blank unit; field notes don't (`field_notes` CHECK demands equipment_number),
   * so the standalone notes picker sets this true.
   */
  requireEquipmentNumber?: boolean;
  /** CTA label for the equipment action (default "Add equipment"). */
  equipmentCtaLabel?: string;
  onAddEquipment: (input: AddEquipmentInput) => void;
  onAddPerson: (personId: string) => void;
}

export default function AddSubjectPanel({
  crewMembers,
  crewRosterIds,
  existingPersonIds,
  busy = false,
  requireEquipmentNumber = false,
  equipmentCtaLabel = "Add equipment",
  onAddEquipment,
  onAddPerson,
}: AddSubjectPanelProps) {
  const [mode, setMode] = useState<"equipment" | "person">("equipment");

  // Equipment form state
  const [typeToken, setTypeToken] = useState("");
  const [unitSelect, setUnitSelect] = useState("");
  const [numberText, setNumberText] = useState("");
  const [customType, setCustomType] = useState("");

  // Person search
  const [search, setSearch] = useState("");

  const selectedType = useMemo(
    () => FIELD_AUDIT_EQUIPMENT_TYPES.find((t) => t.token === typeToken),
    [typeToken],
  );
  const isCustomType = typeToken === CUSTOM_EQUIPMENT_TOKEN;
  const hasKnownUnits = (selectedType?.units.length ?? 0) > 0;
  const showNumberText =
    isCustomType ||
    (!hasKnownUnits && Boolean(typeToken)) ||
    (hasKnownUnits && unitSelect === OTHER_UNIT);

  const resolvedType = isCustomType ? customType.trim() : typeToken;
  const resolvedNumber = isCustomType
    ? numberText
    : hasKnownUnits
      ? unitSelect === OTHER_UNIT
        ? numberText
        : unitSelect
      : numberText;

  const baseCanAdd = isCustomType
    ? customType.trim().length > 0
    : Boolean(typeToken);
  const canAddEquipment =
    baseCanAdd &&
    (!requireEquipmentNumber || resolvedNumber.trim().length > 0);

  const resetEquipment = () => {
    setTypeToken("");
    setUnitSelect("");
    setNumberText("");
    setCustomType("");
  };

  const handleAddEquipment = () => {
    if (!canAddEquipment || busy) return;
    onAddEquipment({
      equipmentType: resolvedType,
      equipmentNumber: resolvedNumber,
      isCustom: isCustomType,
    });
    resetEquipment();
  };

  const sortedPeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = crewMembers.filter((m) => {
      if (!term) return true;
      return (
        (m.full_name ?? "").toLowerCase().includes(term) ||
        (m.email ?? "").toLowerCase().includes(term)
      );
    });
    return [...filtered].sort((a, b) => {
      const aRoster = crewRosterIds.has(a.id) ? 0 : 1;
      const bRoster = crewRosterIds.has(b.id) ? 0 : 1;
      if (aRoster !== bRoster) return aRoster - bRoster;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [crewMembers, crewRosterIds, search]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      {/* Mode tabs */}
      <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5 mb-3.5">
        <button
          type="button"
          onClick={() => setMode("equipment")}
          data-testid="field-audit-add-equipment-tab"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === "equipment"
              ? "bg-rose-500/20 text-rose-200"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" aria-hidden />
          Equipment
        </button>
        <button
          type="button"
          onClick={() => setMode("person")}
          data-testid="field-audit-add-person-tab"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === "person"
              ? "bg-rose-500/20 text-rose-200"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <User className="w-3.5 h-3.5" aria-hidden />
          Person
        </button>
      </div>

      {mode === "equipment" ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={typeToken}
              onChange={(e) => {
                setTypeToken(e.target.value);
                setUnitSelect("");
                setNumberText("");
              }}
              data-testid="field-audit-equipment-type"
              aria-label="Equipment type"
              className={INPUT_CLASS}
            >
              <option value="">— Equipment type —</option>
              {FIELD_AUDIT_EQUIPMENT_TYPES.map((t) => (
                <option key={t.token} value={t.token}>
                  {t.label}
                </option>
              ))}
              <option value={CUSTOM_EQUIPMENT_TOKEN}>Other / new unit…</option>
            </select>

            {isCustomType && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Equipment type (free text)"
                aria-label="Custom equipment type"
                data-testid="field-audit-equipment-custom-type"
                className={INPUT_CLASS}
              />
            )}

            {!isCustomType && hasKnownUnits && (
              <select
                value={unitSelect}
                onChange={(e) => setUnitSelect(e.target.value)}
                aria-label="Unit number"
                data-testid="field-audit-equipment-unit"
                className={INPUT_CLASS}
              >
                <option value="">— Unit number —</option>
                {selectedType!.units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value={OTHER_UNIT}>Other unit…</option>
              </select>
            )}

            {showNumberText && (
              <input
                type="text"
                value={numberText}
                onChange={(e) => setNumberText(e.target.value)}
                placeholder="Unit number (optional)"
                aria-label="Unit number (free text)"
                data-testid="field-audit-equipment-number"
                className={INPUT_CLASS}
              />
            )}
          </div>

          <button
            type="button"
            onClick={handleAddEquipment}
            disabled={!canAddEquipment || busy}
            data-testid="field-audit-add-equipment-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 border border-rose-500/30 px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="w-3.5 h-3.5" aria-hidden />
            )}
            {equipmentCtaLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
              aria-hidden
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crew & profiles…"
              aria-label="Search people"
              data-testid="field-audit-person-search"
              className={`${INPUT_CLASS} pl-8`}
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
            {sortedPeople.length === 0 ? (
              <p className="px-1 py-2 text-xs text-white/35">No people found.</p>
            ) : (
              sortedPeople.map((m) => {
                const added = existingPersonIds.has(m.id);
                const onRoster = crewRosterIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={added || busy}
                    onClick={() => onAddPerson(m.id)}
                    data-testid="field-audit-person-option"
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-white/90 truncate">
                        {m.full_name || m.email || "Unknown"}
                      </span>
                      <span className="block text-[11px] text-white/40 truncate">
                        {m.role}
                        {onRoster ? " · on crew" : ""}
                      </span>
                    </span>
                    {added ? (
                      <span className="text-[11px] text-white/40 shrink-0">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-rose-300 shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
