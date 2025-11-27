import { useState, useRef, FormEvent } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { ArrowLeft, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ChecklistValue = "" | "P" | "F";

interface ChecklistItem {
  id: string;
  label: string;
}

// General checklist items (Section A)
const GENERAL_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "engine_bay_debris", label: "Engine bay clear of debris" },
  { id: "windshield", label: "Windshield" },
  { id: "seat", label: "Seat" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "housekeeping", label: "Housekeeping / cab cleanliness" },
  { id: "muffler", label: "Muffler" },
  { id: "seat_belts", label: "Seat belts" },
  { id: "mirrors_cameras", label: "Mirrors / backup cameras" },
  { id: "backup_beepers", label: "Backup beepers" },
  { id: "battery_cables", label: "Battery cables secure" },
  { id: "wipers", label: "Windshield wipers" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "first_aid_kit", label: "First aid kit" },
  { id: "emergency_kill", label: "Emergency kill switch" },
  { id: "grease", label: "Grease (within last 8 hours)" },
];

// Specific equipment checklist groups (Section B)
const SKY_TRIM_ITEMS: ChecklistItem[] = [
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels / lugs" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms / booms" },
  { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
  { id: "controls", label: "Controls" },
  { id: "system_function", label: "System function test" },
];

const GEO_BOY_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "teeth", label: "Teeth / cutting head" },
  { id: "hydraulic_lines", label: "Hydraulic lines" },
  { id: "attachments", label: "Attachments secure" },
  { id: "system_function", label: "System function test" },
];

const SKID_STEER_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms" },
  { id: "attachments", label: "Attachments (mulcher / grapple)" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "system_function", label: "System function test" },
];

type EquipmentTemplate = "sky_trim" | "geo_boy" | "skid_steer" | "";

function getSpecificItems(template: EquipmentTemplate): ChecklistItem[] {
  switch (template) {
    case "sky_trim":
      return SKY_TRIM_ITEMS;
    case "geo_boy":
      return GEO_BOY_ITEMS;
    case "skid_steer":
      return SKID_STEER_ITEMS;
    default:
      return [];
  }
}

type PhotoTypes = "overview" | "damage" | "attachments";

type PhotoState = Partial<Record<PhotoTypes, File>>;

export default function DailyEquipmentInspectionForm() {
  const navigate = useNavigate();

  const [equipmentType, setEquipmentType] = useState("");
  const [equipmentNumber, setEquipmentNumber] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [template, setTemplate] = useState<EquipmentTemplate>("");

  const [notes, setNotes] = useState("");
  const [generalChecklist, setGeneralChecklist] = useState<
    Record<string, ChecklistValue>
  >({});
  const [specificChecklist, setSpecificChecklist] = useState<
    Record<string, ChecklistValue>
  >({});

  const [photos, setPhotos] = useState<PhotoState>({});
  const overviewRef = useRef<HTMLInputElement | null>(null);
  const damageRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleChecklistChange(
    type: "general" | "specific",
    id: string,
    value: ChecklistValue
  ) {
    if (type === "general") {
      setGeneralChecklist((prev) => ({ ...prev, [id]: value }));
    } else {
      setSpecificChecklist((prev) => ({ ...prev, [id]: value }));
    }
  }

  function handlePhotoChange(kind: PhotoTypes, file?: File) {
    setPhotos((prev) => ({
      ...prev,
      [kind]: file,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!equipmentType.trim() || !equipmentNumber.trim()) {
      setError("Equipment type and equipment number are required.");
      return;
    }

    try {
      setSubmitting(true);

      // TODO: Replace this with your actual API / Supabase / Make.com logic.
      // Example shape using FormData (because of file uploads):
      //
      // const data = new FormData();
      // data.append("equipmentType", equipmentType);
      // data.append("equipmentNumber", equipmentNumber);
      // data.append("inspectionDate", inspectionDate);
      // data.append("template", template);
      // data.append("notes", notes);
      // data.append("generalChecklist", JSON.stringify(generalChecklist));
      // data.append("specificChecklist", JSON.stringify(specificChecklist));
      // if (photos.overview) data.append("overviewPhoto", photos.overview);
      // if (photos.damage) data.append("damagePhoto", photos.damage);
      // if (photos.attachments) data.append("attachmentsPhoto", photos.attachments);
      //
      // await fetch("/api/equipment-inspections", {
      //   method: "POST",
      //   body: data,
      // });

      setSuccess("Daily equipment inspection submitted.");
      // Optionally reset some fields
      // setGeneralChecklist({});
      // setSpecificChecklist({});
      // setPhotos({});
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong submitting the inspection.");
    } finally {
      setSubmitting(false);
    }
  }

  const specificItems = getSpecificItems(template);

  return (
    <DashboardLayout title="Daily Equipment Inspection">
      <div className="max-w-3xl mx-auto">
       
        {/* Info banner */}
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-100">
          This form should be completed daily before operating equipment. Attach
          photos as needed to document condition or damage.
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card: Equipment Info */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                Equipment Information
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Equipment Type *
                </label>
                <input
                  value={equipmentType}
                  onChange={(e) => setEquipmentType(e.target.value)}
                  placeholder="Geo Boy, Skid Steer, Sky Trim, etc."
                  className="w-full rounded-md bg-black/60 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Equipment Number *
                </label>
                <input
                  value={equipmentNumber}
                  onChange={(e) => setEquipmentNumber(e.target.value)}
                  className="w-full rounded-md bg-black/60 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full rounded-md bg-black/60 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Equipment Template (for specific checklist)
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as EquipmentTemplate)}
                  className="w-full rounded-md bg-black/60 border border-gray-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select template</option>
                  <option value="sky_trim">Sky Trim / Jarraff</option>
                  <option value="geo_boy">Geo Boy Mulcher</option>
                  <option value="skid_steer">Skid Steer Mulcher / Grapple</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card: General Checklist */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                General Equipment Checklist
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                P = Pass, F = Fail
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GENERAL_ITEMS.map((item) => {
                const value = generalChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/40 px-3 py-2"
                  >
                    <span className="text-xs text-gray-100 pr-2">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("general", item.id, "P")
                        }
                        className={`px-2 py-1 text-[10px] rounded-md border ${
                          value === "P"
                            ? "bg-emerald-600 border-emerald-400 text-white"
                            : "bg-black/60 border-gray-600 text-gray-300"
                        }`}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("general", item.id, "F")
                        }
                        className={`px-2 py-1 text-[10px] rounded-md border ${
                          value === "F"
                            ? "bg-red-600 border-red-400 text-white"
                            : "bg-black/60 border-gray-600 text-gray-300"
                        }`}
                      >
                        F
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Specific Equipment Checklist */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                Specific Equipment Checklist
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Based on selected template
              </span>
            </div>

            {specificItems.length === 0 ? (
              <p className="text-xs text-gray-400">
                Select an equipment template above to load specific checklist
                items.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {specificItems.map((item) => {
                  const value = specificChecklist[item.id] || "";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/40 px-3 py-2"
                    >
                      <span className="text-xs text-gray-100 pr-2">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleChecklistChange("specific", item.id, "P")
                          }
                          className={`px-2 py-1 text-[10px] rounded-md border ${
                            value === "P"
                              ? "bg-emerald-600 border-emerald-400 text-white"
                              : "bg-black/60 border-gray-600 text-gray-300"
                          }`}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleChecklistChange("specific", item.id, "F")
                          }
                          className={`px-2 py-1 text-[10px] rounded-md border ${
                            value === "F"
                              ? "bg-red-600 border-red-400 text-white"
                              : "bg-black/60 border-gray-600 text-gray-300"
                          }`}
                        >
                          F
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card: Photos (Camera Capture, optional) */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                Photos (Camera Capture)
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Optional, but recommended
              </span>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={overviewRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange("overview", file);
              }}
            />
            <input
              ref={damageRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange("damage", file);
              }}
            />
            <input
              ref={attachmentsRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoChange("attachments", file);
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => overviewRef.current?.click()}
                className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
              >
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Equipment Overview (optional)
                </span>
                <span className="text-[10px] text-gray-500">
                  {photos.overview ? "Captured" : "Not captured"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => damageRef.current?.click()}
                className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
              >
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Damage / wear (optional)
                </span>
                <span className="text-[10px] text-gray-500">
                  {photos.damage ? "Captured" : "Not captured"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => attachmentsRef.current?.click()}
                className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
              >
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Attachments / teeth (optional)
                </span>
                <span className="text-[10px] text-gray-500">
                  {photos.attachments ? "Captured" : "Not captured"}
                </span>
              </button>
            </div>
          </div>

          {/* Card: Notes */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                Notes / Deficiencies
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Optional
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md bg-black/60 border border-gray-700 px-3 py-2 text-sm text-white"
              placeholder="Describe any deficiencies, damage, or required follow-up..."
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Daily Equipment Inspection"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
