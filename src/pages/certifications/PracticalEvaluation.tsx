import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import {
  useCertificationTypes,
  usePracticalTemplates,
  useCanEvaluateUser,
  useSubmitPracticalEvaluation,
} from "../../hooks/useCertifications";
import { useUserQuery } from "../../hooks/queries/useUsersQuery";

type ChecklistState = Record<
  string,
  { item_id: string; item_name: string; passed: boolean; notes: string }[]
>;

export default function PracticalEvaluation() {
  const { certSlug, userId } = useParams<{ certSlug: string; userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: types } = useCertificationTypes();
  const cert = useMemo(() => types?.find((t) => t.slug === certSlug), [types, certSlug]);
  const certTypeId = cert?.id;

  const { data: templates, isLoading: templatesLoading } = usePracticalTemplates(certTypeId);
  const { data: canEval, isLoading: canEvalLoading } = useCanEvaluateUser(userId, certTypeId, user?.id);
  const { data: evaluatee } = useUserQuery(userId ?? "");
  const submitEval = useSubmitPracticalEvaluation();

  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [notes, setNotes] = useState("");

  const initialChecklist = useMemo<ChecklistState>(() => {
    const out: ChecklistState = {};
    for (const t of templates ?? []) {
      const items = (t.items as { item_id: string; item_name: string }[]) ?? [];
      out[t.category_name] = items.map((it) => ({
        item_id: it.item_id,
        item_name: it.item_name,
        passed: false,
        notes: "",
      }));
    }
    return out;
  }, [templates]);

  useEffect(() => {
    if (!Object.keys(initialChecklist).length) return;
    queueMicrotask(() =>
      setChecklist((prev) => (Object.keys(prev).length ? prev : initialChecklist))
    );
  }, [initialChecklist]);

  const handleToggle = (cat: string, idx: number, value: boolean) => {
    setChecklist((p) => ({
      ...p,
      [cat]: (p[cat] ?? []).map((it, i) =>
        i === idx ? { ...it, passed: value } : it
      ),
    }));
  };

  const handleSubmit = async () => {
    if (!userId || !certTypeId) return;
    const items = Object.keys(checklist).length ? checklist : initialChecklist;
    if (!Object.keys(items).length) {
      toast.error("No checklist loaded.");
      return;
    }
    try {
      await submitEval.mutateAsync({
        userId,
        certificationTypeId: certTypeId,
        checklistItems: items,
        evaluatorNotes: notes || undefined,
      });
      toast.success("Evaluation submitted.");
      navigate("/admin/certifications");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed.");
    }
  };

  if (!cert) {
    return (
      <DashboardLayout title="Practical Evaluation">
        <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          {types === undefined ? "Loading…" : "Certification not found."}
        </div>
      </DashboardLayout>
    );
  }

  if (canEvalLoading || templatesLoading) {
    return (
      <DashboardLayout title={`${cert.name} — Practical`}>
        <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-white/5 p-6 text-center text-gray-400">
          Loading…
        </div>
      </DashboardLayout>
    );
  }

  if (!canEval) {
    return (
      <DashboardLayout title={`${cert.name} — Practical`}>
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-amber-400">You are not authorized to perform this evaluation.</p>
          <Link
            to="/admin/certifications"
            className="inline-block rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
          >
            Back to Certifications
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const cats = (templates ?? []).sort((a, b) => a.category_order - b.category_order);

  return (
    <DashboardLayout title={`${cert.name} — Practical`}>
      <div className="mx-auto max-w-2xl space-y-6 px-4">
        <p className="text-sm text-gray-400">
          Evaluating {evaluatee?.full_name ?? "Unknown"} for {cert.name}.
        </p>

        {cats.map((t) => (
          <section key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">{t.category_name.replace(/_/g, " ")}</h3>
            <div className="space-y-2 sm:space-y-2">
              {(checklist[t.category_name] ?? initialChecklist[t.category_name] ?? []).map((it, idx) => (
                <div
                  key={it.item_id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2"
                >
                  <span className="min-w-0 text-sm text-white sm:flex-1" id={`label-${t.category_name}-${it.item_id}`}>
                    {it.item_name}
                  </span>
                  <fieldset
                    className="flex shrink-0 items-center gap-4 border-0 p-0 sm:gap-2"
                    aria-labelledby={`label-${t.category_name}-${it.item_id}`}
                  >
                    <legend className="sr-only">
                      {it.item_name}: Pass or Fail
                    </legend>
                    <label className="flex min-h-[44px] min-w-[72px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10 has-[:checked]:border-emerald-500/50 has-[:checked]:bg-emerald-500/20 sm:min-h-0 sm:min-w-0 sm:justify-start">
                      <input
                        type="radio"
                        name={`${t.category_name}-${it.item_id}`}
                        checked={it.passed === true}
                        onChange={() => handleToggle(t.category_name, idx, true)}
                        className="sr-only"
                        aria-label={`${it.item_name}: Pass`}
                      />
                      Pass
                    </label>
                    <label className="flex min-h-[44px] min-w-[72px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10 has-[:checked]:border-red-500/50 has-[:checked]:bg-red-500/20 sm:min-h-0 sm:min-w-0 sm:justify-start">
                      <input
                        type="radio"
                        name={`${t.category_name}-${it.item_id}`}
                        checked={it.passed === false}
                        onChange={() => handleToggle(t.category_name, idx, false)}
                        className="sr-only"
                        aria-label={`${it.item_name}: Fail`}
                      />
                      Fail
                    </label>
                  </fieldset>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div>
          <label className="mb-1 block text-sm text-gray-400">Evaluator notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            rows={3}
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitEval.isPending}
            className="min-h-[44px] rounded-lg bg-amber-500/20 px-4 py-3 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            {submitEval.isPending ? "Submitting…" : "Submit evaluation"}
          </button>
          <Link
            to="/admin/certifications"
            className="flex min-h-[44px] items-center rounded-lg bg-white/10 px-4 py-3 text-sm text-gray-300 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Cancel
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
