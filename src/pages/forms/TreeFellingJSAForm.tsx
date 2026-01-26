import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

export default function TreeFellingJSAForm() {
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

      const { error } = await supabase.from("daily_jsa").insert({
        user_id: user.id,
        job_date: jobDate || null,
        work_location: workLocation || null,
        gf_contact: gfContact || null,
        oc_contact: ocContact || null,
        jsa_type: "tree_felling",
        tree_felling_data: treeData,
        observer_signatures,
        status: targetStatus,
        status_changed_at: now,
        status_history: [{ status: targetStatus, timestamp: now }],
        completed_at: targetStatus === "completed" ? now : null,
        shared_with_users: [],
        jobs_performed: [],
        ppe: {},
        weather_conditions: { conditions: {}, modifiers: {} },
        weather_hazards: null,
        hazards_present: {},
        traffic_hazards: {},
        traffic_setup: {},
        spans: [],
        notes: null,
        employee_signature: null,
      });

      if (error) throw error;
      toast.success(asDraft ? "Draft saved." : "Tree Felling JSA submitted.");
      navigate("/forms-history/jsa");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Tree Felling JSA">
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-8">
        <p className="text-sm text-gray-400">
          Specialized JSA for tree felling operations. Complete tree risk, environmental and operational factors, then sign.
        </p>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Date & location</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Date</label>
              <input
                type="date"
                value={jobDate}
                onChange={(e) => setJobDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Save draft"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Submit Tree Felling JSA"
          >
            Submit
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
