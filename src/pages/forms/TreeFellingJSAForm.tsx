import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";

interface TreeFellingData {
  tree_risk_assessment: { height_risk?: string; dbh_risk?: string };
  environmental_factors: {
    exposed_roots?: string;
    leaning?: string;
    tree_condition?: string;
    trunk_condition?: string;
  };
  operational_factors: {
    slope?: string;
    notch_type?: string;
    fall_path?: string;
    wind?: string;
    weather?: string;
    distance_from_lines?: string;
  };
  hazards_present: string;
  mitigation: string;
}

const EMPTY_TREE_DATA: TreeFellingData = {
  tree_risk_assessment: {},
  environmental_factors: {},
  operational_factors: {},
  hazards_present: "",
  mitigation: "",
};

/** Safely parse tree_felling_data from DB into TreeFellingData */
function parseTreeFellingData(raw: unknown): TreeFellingData {
  if (!raw || typeof raw !== "object") return EMPTY_TREE_DATA;
  const o = raw as Record<string, unknown>;
  return {
    tree_risk_assessment: (o.tree_risk_assessment as TreeFellingData["tree_risk_assessment"]) ?? {},
    environmental_factors: (o.environmental_factors as TreeFellingData["environmental_factors"]) ?? {},
    operational_factors: (o.operational_factors as TreeFellingData["operational_factors"]) ?? {},
    hazards_present: typeof o.hazards_present === "string" ? o.hazards_present : "",
    mitigation: typeof o.mitigation === "string" ? o.mitigation : "",
  };
}

/** Map observer_signatures from DB to form shape */
function parseObserverSignatures(raw: unknown): { name: string; signature_data: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ name: "", signature_data: "" }];
  return raw.map((item) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: typeof o.name === "string" ? o.name : "",
      signature_data: typeof o.signature_data === "string" ? o.signature_data : "",
    };
  });
}

export default function TreeFellingJSAForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobDate, setJobDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [workLocation, setWorkLocation] = useState("");
  const [gfContact, setGfContact] = useState("");
  const [ocContact, setOcContact] = useState("");
  const [treeData, setTreeData] = useState<TreeFellingData>(EMPTY_TREE_DATA);
  const [signatures, setSignatures] = useState<{ name: string; signature_data: string }[]>(
    [{ name: "", signature_data: "" }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const updateTree = (section: keyof TreeFellingData, key: string, value: string) => {
    setTreeData((prev) => {
      const s = prev[section];
      if (typeof s === "object" && s !== null && !Array.isArray(s)) {
        return { ...prev, [section]: { ...s, [key]: value } };
      }
      return prev;
    });
  };

  const addSignature = () => {
    if (signatures.length >= 6) return;
    setSignatures((p) => [...p, { name: "", signature_data: "" }]);
  };

  // Load existing record when editing
  useEffect(() => {
    if (!id || !user?.id) return;
    const fetchRecord = async () => {
      setLoadingRecord(true);
      const { data, error } = await supabase
        .from("daily_jsa")
        .select(
          "id, user_id, job_date, work_location, gf_contact, oc_contact, tree_felling_data, observer_signatures, status"
        )
        .eq("id", id)
        .eq("jsa_type", "tree_felling")
        .maybeSingle();

      if (error) {
        toast.error("Unable to load JSA. Please try again.");
        setLoadingRecord(false);
        return;
      }
      if (!data) {
        toast.error("JSA not found or you don't have permission to edit it.");
        setLoadingRecord(false);
        return;
      }
      setJobDate((data.job_date ?? "").toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
      setWorkLocation((data.work_location ?? "") as string);
      setGfContact((data.gf_contact ?? "") as string);
      setOcContact((data.oc_contact ?? "") as string);
      setTreeData(parseTreeFellingData(data.tree_felling_data));
      setSignatures(parseObserverSignatures(data.observer_signatures));
      setLoadingRecord(false);
    };
    fetchRecord();
  }, [id, user?.id]);

  const handleSubmit = async (asDraft: boolean) => {
    if (!user?.id) return;
    const targetStatus = asDraft ? "draft" : "completed";
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const observer_signatures = signatures
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name,
          signature_data: s.signature_data || "",
          timestamp: now,
        }));

      const payload = {
        job_date: jobDate || null,
        work_location: workLocation || null,
        gf_contact: gfContact || null,
        oc_contact: ocContact || null,
        jsa_type: "tree_felling" as const,
        tree_felling_data: treeData,
        observer_signatures,
        status: targetStatus,
        status_changed_at: now,
        status_history: [{ status: targetStatus, timestamp: now }],
        completed_at: targetStatus === "completed" ? now : null,
        shared_with_users: [] as unknown[],
        jobs_performed: [] as unknown[],
        ppe: {} as Record<string, unknown>,
        weather_conditions: { conditions: {}, modifiers: {} },
        weather_hazards: null as string | null,
        hazards_present: {} as Record<string, unknown>,
        traffic_hazards: {} as Record<string, unknown>,
        traffic_setup: {} as Record<string, unknown>,
        spans: [] as unknown[],
        notes: null as string | null,
        employee_signature: null as string | null,
        updated_at: now,
      };

      if (isEditMode && id) {
        const { error } = await supabase
          .from("daily_jsa")
          .update(payload)
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success(asDraft ? "Draft updated." : "Tree Felling JSA updated.");
      } else {
        const { error } = await supabase.from("daily_jsa").insert({
          ...payload,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success(asDraft ? "Draft saved." : "Tree Felling JSA submitted.");
      }
      navigate("/forms-history/jsa");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = isEditMode && loadingRecord;

  return (
    <DashboardLayout title={isEditMode ? "Edit Tree Felling JSA" : "Tree Felling JSA"}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-8">
        {isLoading && (
          <p className="text-sm text-amber-300" role="status">Loading JSA…</p>
        )}
        <p className="text-sm text-gray-400">
          Specialized JSA for tree felling operations. Complete tree risk, environmental and operational factors, then sign.
        </p>

        <fieldset className="space-y-6" disabled={isLoading} aria-busy={isLoading}>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Date & location</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Date</label>
              <input
                type="date"
                value={jobDate}
                onChange={(e) => setJobDate(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Location</label>
              <input
                type="text"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                placeholder="Work site"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">GF phone</label>
              <input
                type="text"
                value={gfContact}
                onChange={(e) => setGfContact(e.target.value)}
                placeholder="General foreman"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">OC phone</label>
              <input
                type="text"
                value={ocContact}
                onChange={(e) => setOcContact(e.target.value)}
                placeholder="Operations contact"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Tree risk assessment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Height risk</label>
              <input
                type="text"
                value={treeData.tree_risk_assessment?.height_risk ?? ""}
                onChange={(e) => updateTree("tree_risk_assessment", "height_risk", e.target.value)}
                placeholder="e.g. high / medium / low"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">DBH risk</label>
              <input
                type="text"
                value={treeData.tree_risk_assessment?.dbh_risk ?? ""}
                onChange={(e) => updateTree("tree_risk_assessment", "dbh_risk", e.target.value)}
                placeholder="Diameter at breast height"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Environmental factors</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["exposed_roots", "leaning", "tree_condition", "trunk_condition"] as const).map(
              (k) => (
                <div key={k}>
                  <label className="mb-1 block text-xs text-gray-400">
                    {k.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={treeData.environmental_factors?.[k] ?? ""}
                    onChange={(e) => updateTree("environmental_factors", k, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                  />
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Operational factors</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                "slope",
                "notch_type",
                "fall_path",
                "wind",
                "weather",
                "distance_from_lines",
              ] as const
            ).map((k) => (
              <div key={k}>
                <label className="mb-1 block text-xs text-gray-400">
                  {k.replace(/_/g, " ")}
                </label>
                <input
                  type="text"
                  value={treeData.operational_factors?.[k] ?? ""}
                  onChange={(e) => updateTree("operational_factors", k, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <label className="block text-sm font-semibold text-white">Hazards present</label>
          <textarea
            value={treeData.hazards_present}
            onChange={(e) =>
              setTreeData((p) => ({ ...p, hazards_present: e.target.value }))
            }
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
          />
          <label className="block text-sm font-semibold text-white">Mitigation</label>
          <textarea
            value={treeData.mitigation}
            onChange={(e) =>
              setTreeData((p) => ({ ...p, mitigation: e.target.value }))
            }
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
          />
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Signatures (up to 6)</h3>
            {signatures.length < 6 && (
              <button
                type="button"
                onClick={addSignature}
                className="text-xs text-amber-400 hover:underline"
              >
                + Add
              </button>
            )}
          </div>
          {signatures.map((sig, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={sig.name}
                onChange={(e) =>
                  setSignatures((p) =>
                    p.map((s, j) => (j === i ? { ...s, name: e.target.value } : s))
                  )
                }
                placeholder="Name"
                className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
              <input
                type="text"
                value={sig.signature_data}
                onChange={(e) =>
                  setSignatures((p) =>
                    p.map((s, j) => (j === i ? { ...s, signature_data: e.target.value } : s))
                  )
                }
                placeholder="Initials / signature"
                className="w-28 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          ))}
        </section>

        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting || isLoading}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Save draft"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting || isLoading}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={isEditMode ? "Update Tree Felling JSA" : "Submit Tree Felling JSA"}
          >
            {isEditMode ? "Update" : "Submit"}
          </button>
          <Link
            to="/forms"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Back to Forms"
          >
            Back to Forms
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
