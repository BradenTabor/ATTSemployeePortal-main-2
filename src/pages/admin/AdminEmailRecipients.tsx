import { useEffect, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Mail, Plus, Trash2, Upload, Send, Shield, History, CheckCircle, XCircle } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { logger } from "../../lib/logger";

type ListKey = "compliance_summary" | "safety_forecast";

const LISTS: { key: ListKey; label: string; description: string }[] = [
  {
    key: "compliance_summary",
    label: "Compliance Summary",
    description: "Daily 9 AM safety form compliance report recipients",
  },
  {
    key: "safety_forecast",
    label: "Safety Forecast",
    description: "Daily 6:30 AM safety forecast email recipients",
  },
];

const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
function isValidEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return EMAIL_REGEX.test(lower);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function AdminEmailRecipients() {
  const { role, user } = useAuth();
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [listKey, setListKey] = useState<ListKey>("compliance_summary");
  const [recipients, setRecipients] = useState<{ email: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [addPending, setAddPending] = useState(false);
  const [removePending, setRemovePending] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logRows, setLogRows] = useState<{ list_key: string; recipients: string[]; sent_at: string; success: boolean; error_message: string | null }[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && !error && data?.id) setAppUserId(data.id);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_recipient_lists")
        .select("email, created_at")
        .eq("list_key", listKey)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecipients((data ?? []) as { email: string; created_at: string }[]);
    } catch (e) {
      logger.error("[AdminEmailRecipients] Fetch error:", e);
      toast.error((e as Error)?.message ?? "Failed to load recipients");
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [listKey]);

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("list_key, recipients, sent_at, success, error_message")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogRows((data ?? []) as { list_key: string; recipients: string[]; sent_at: string; success: boolean; error_message: string | null }[]);
    } catch (e) {
      logger.error("[AdminEmailRecipients] Log fetch error:", e);
      toast.error((e as Error)?.message ?? "Failed to load send log");
      setLogRows([]);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    if (logOpen) fetchLog();
  }, [logOpen, fetchLog]);

  const handleAdd = async () => {
    const email = normalizeEmail(newEmail);
    if (!email) {
      toast.error("Enter an email address");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Invalid email format");
      return;
    }
    setAddPending(true);
    try {
      const { error } = await supabase.from("email_recipient_lists").insert({
        list_key: listKey,
        email,
        ...(appUserId ? { created_by_user_id: appUserId } : {}),
      });
      if (error) {
        if (error.message?.includes("duplicate") || error.code === "23505") {
          toast.error("Email already in list");
        } else if (error.message?.includes("valid_email") || error.message?.includes("email_lowercase")) {
          toast.error("Invalid email format");
        } else {
          toast.error(error.message ?? "Failed to add");
        }
        return;
      }
      toast.success("Email added");
      setNewEmail("");
      await fetchRecipients();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to add");
    } finally {
      setAddPending(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (recipients.length <= 1) {
      toast.error("Cannot remove the last recipient");
      return;
    }
    setRemovePending(email);
    try {
      const { error } = await supabase
        .from("email_recipient_lists")
        .delete()
        .eq("list_key", listKey)
        .eq("email", email);
      if (error) {
        if (error.message?.includes("Cannot delete last recipient")) {
          toast.error("Cannot remove the last recipient");
        } else {
          toast.error(error.message ?? "Failed to remove");
        }
        return;
      }
      toast.success("Email removed");
      await fetchRecipients();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to remove");
    } finally {
      setRemovePending(null);
    }
  };

  const handleBulk = async () => {
    const raw = bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const toAdd = raw.map(normalizeEmail).filter((e) => isValidEmail(e));
    const invalid = raw.filter((r) => !isValidEmail(normalizeEmail(r)));
    if (invalid.length) {
      toast.error(`Invalid: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`);
      return;
    }
    if (!toAdd.length) {
      toast.error("Enter valid emails (one per line or comma‑separated)");
      return;
    }
    setBulkPending(true);
    try {
      const rows = toAdd.map((email) => ({
        list_key: listKey,
        email,
        ...(appUserId ? { created_by_user_id: appUserId } : {}),
      }));
      const { error } = await supabase
        .from("email_recipient_lists")
        .upsert(rows, {
          onConflict: "list_key,email",
          ignoreDuplicates: true,
        });
      if (error) {
        toast.error(error.message ?? "Bulk add failed");
        return;
      }
      toast.success("Bulk import complete");
      setBulkText("");
      setBulkOpen(false);
      await fetchRecipients();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Bulk add failed");
    } finally {
      setBulkPending(false);
    }
  };

  const handleTest = async () => {
    setTestPending(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string; count?: number }>("send-test-email", {
        body: { listKey },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Test email sent to ${data?.count ?? recipients.length} recipient(s)`);
    } catch (e) {
      let message = (e as Error)?.message ?? "Failed to send test email";
      if (e instanceof FunctionsHttpError && e.context && typeof (e.context as Response).json === "function") {
        try {
          const body = (await (e.context as Response).json()) as { error?: string; details?: string };
          if (body?.error) message = body.error;
          else if (body?.details) message = body.details;
        } catch {
          /* use default message */
        }
      }
      toast.error(message);
    } finally {
      setTestPending(false);
    }
  };

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">Admin access required.</p>
        </div>
      </div>
    );
  }

  const current = LISTS.find((l) => l.key === listKey)!;

  return (
    <DashboardLayout title="Email Recipients">
      {/* pb-20: clear space above fixed ReturnButton/FAB on small screens */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pb-20 sm:pb-8 pt-2 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-3 sm:p-6 shadow-xl"
        >
          <h2 className="text-base sm:text-lg font-bold text-white mb-0.5">Automated email lists</h2>
          <p className="text-xs sm:text-sm text-[#c7b696] mb-4">
            Manage who receives compliance and safety forecast emails. Use <strong>Send Test</strong> to verify.
          </p>

          {/* Tabs: stack on small screens to avoid crowding */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            {LISTS.map((l) => (
              <button
                key={l.key}
                onClick={() => setListKey(l.key)}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex-1 sm:flex-initial ${
                  listKey === l.key
                    ? "bg-[#f4c979]/20 border border-[#f4c979]/40 text-[#fef3d1]"
                    : "border border-[#f6dcb2]/25 text-[#c7b696] hover:bg-white/5"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mb-3">
            <p className="text-xs sm:text-sm text-[#c7b696] leading-snug">{current.description}</p>
          </div>

          {/* Add row: input flex-1 min-w-0 so Add button never truncates */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
            <div className="flex gap-2 flex-1 min-w-0">
              <input
                type="email"
                placeholder="admin@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 min-w-0 rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-[#fdf4db] placeholder:text-[#8a7a5c] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
              />
              <button
                onClick={handleAdd}
                disabled={addPending}
                className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
                aria-label="Add email"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setBulkOpen(!bulkOpen)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#f6dcb2]/25 text-xs sm:text-sm font-semibold text-[#fdf4db] hover:bg-white/5 flex items-center gap-1.5"
                aria-label="Bulk import emails"
              >
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Bulk import</span>
              </button>
              <button
                onClick={handleTest}
                disabled={testPending || recipients.length === 0}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-emerald-500/30 text-xs sm:text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 flex items-center gap-1.5"
                aria-label={testPending ? "Sending test email…" : "Send test email"}
              >
                <Send className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{testPending ? "Sending…" : "Send test"}</span>
              </button>
            </div>
          </div>

          {bulkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 p-3 sm:p-4 rounded-xl bg-[#050402]/50 border border-[#f6dcb2]/15"
            >
              <label className="block text-xs font-semibold text-[#f4c979]/80 uppercase tracking-wider mb-2">
                Paste emails (one per line or comma‑separated)
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={3}
                placeholder="a@example.com, b@example.com"
                className="w-full min-w-0 rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 sm:px-4 py-2 sm:py-3 text-sm text-[#fdf4db] placeholder:text-[#8a7a5c] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 resize-none"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={handleBulk}
                  disabled={bulkPending}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50"
                >
                  {bulkPending ? "Importing…" : "Import"}
                </button>
                <button
                  onClick={() => { setBulkOpen(false); setBulkText(""); }}
                  className="px-3 sm:px-4 py-2 rounded-xl border border-[#f6dcb2]/25 text-sm font-semibold text-[#fdf4db] hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* List: email truncates on small screens; delete always visible */}
          <div className="mb-6 pb-4 sm:pb-0">
            <h3 className="text-xs sm:text-sm font-semibold text-[#f4c979]/90 mb-2">
              Current recipients ({recipients.length})
            </h3>
            {loading ? (
              <p className="text-xs sm:text-sm text-[#c7b696]">Loading…</p>
            ) : recipients.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#c7b696]">No recipients yet. Add one above or bulk import.</p>
            ) : (
              <ul className="space-y-1.5 sm:space-y-2">
                {recipients.map((r) => (
                  <li
                    key={r.email}
                    className="flex items-center gap-2 min-w-0 py-2 px-3 rounded-xl bg-[#050402]/50 border border-[#f6dcb2]/10"
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 text-sm text-[#fdf4db]">
                      <Mail className="w-4 h-4 flex-shrink-0 text-[#c7b696]" />
                      <span className="truncate" title={r.email}>{r.email}</span>
                    </span>
                    <button
                      onClick={() => handleRemove(r.email)}
                      disabled={removePending === r.email || recipients.length <= 1}
                      className="flex-shrink-0 p-2 rounded-lg text-[#c7b696] hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                      aria-label={`Remove ${r.email}`}
                    >
                      {removePending === r.email ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Email send log: compact on small screens */}
          <div className="border-t border-[#f6dcb2]/15 pt-3 sm:pt-4">
            <button
              onClick={() => setLogOpen(!logOpen)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#f4c979]/90 hover:text-[#fef3d1] transition-colors"
            >
              <History className="w-4 h-4 flex-shrink-0" />
              Email send log
              <span className="text-[#c7b696] font-normal">{logOpen ? "−" : "+"}</span>
            </button>
            {logOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 sm:mt-4 overflow-x-auto"
              >
                {logLoading ? (
                  <p className="text-xs sm:text-sm text-[#c7b696]">Loading…</p>
                ) : logRows.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[#c7b696]">No send log entries yet.</p>
                ) : (
                  <div className="rounded-xl border border-[#f6dcb2]/10 overflow-x-auto min-w-0">
                    <table className="w-full text-xs sm:text-sm min-w-[320px]">
                      <thead className="bg-[#050402]/70 border-b border-[#f6dcb2]/10">
                        <tr>
                          <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[#f4c979]/80 font-semibold">List</th>
                          <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[#f4c979]/80 font-semibold">#</th>
                          <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[#f4c979]/80 font-semibold">Sent</th>
                          <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[#f4c979]/80 font-semibold">Status</th>
                          <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[#f4c979]/80 font-semibold max-w-[100px] sm:max-w-[200px] truncate" title="Error">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f6dcb2]/5">
                        {logRows.map((row, i) => (
                          <tr key={i} className="hover:bg-white/5">
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#fdf4db]">{row.list_key.replace("_", " ")}</td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#c7b696]">
                              {Array.isArray(row.recipients) ? row.recipients.length : 0}
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#c7b696] whitespace-nowrap">
                              {new Date(row.sent_at).toLocaleString()}
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                              {row.success ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-400">
                                  <XCircle className="w-4 h-4 flex-shrink-0" /> Failed
                                </span>
                              )}
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#c7b696] max-w-[100px] sm:max-w-[200px] truncate" title={row.error_message ?? ""}>
                              {row.error_message ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

export default memo(AdminEmailRecipients);
