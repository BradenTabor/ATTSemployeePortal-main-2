import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Shield, AlertTriangle, X, Users, UserPlus, Search } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useSendMassSms } from "../../hooks/admin/useSendMassSms";
import { useAuth } from "../../contexts/AuthContext";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";

const MAX_MESSAGE_LENGTH = 480;

type RecipientMode = "all" | "selected";

interface SelectedUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

function AdminMassSms() {
  const { role } = useAuth();
  const {
    preview,
    previewLoading,
    previewError,
    sendMassSms,
    sendLoading,
    cooldownUntil,
    refetchPreview,
  } = useSendMassSms();

  const [message, setMessage] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all");
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerUsers, setPickerUsers] = useState<SelectedUser[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    batches?: Array<{ index: number; sent: number; failed: number; error?: string }>;
  } | null>(null);

  const selectedUserIds = useMemo(() => selectedUsers.map((u) => u.user_id), [selectedUsers]);
  const countWithPhone = preview?.countWithPhone ?? 0;
  const totalUsers = preview?.totalUsers ?? 0;
  const fromNumber = preview?.fromNumber ?? null;
  const confirmMatch = String(countWithPhone) === confirmInput.trim();
  const [now, setNow] = useState(() => Date.now());
  const cooldownRemaining =
    cooldownUntil != null ? Math.max(0, Math.ceil((cooldownUntil - now) / 60000)) : 0;
  const isOnCooldown = cooldownRemaining > 0;
  const isSendToAll = recipientMode === "all";
  const sendDisabledByCooldown = isSendToAll && isOnCooldown;

  useEffect(() => {
    if (!isOnCooldown) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [isOnCooldown]);

  useEffect(() => {
    if (recipientMode === "all") {
      refetchPreview();
    } else {
      refetchPreview(selectedUserIds);
    }
  }, [recipientMode, refetchPreview, selectedUserIds]);

  const handleOpenConfirm = useCallback(() => {
    setConfirmInput("");
    setLastResult(null);
    setConfirmOpen(true);
  }, []);

  const handleConfirmSend = useCallback(async () => {
    if (!confirmMatch || !message.trim()) return;
    const result = await sendMassSms(
      message,
      recipientMode === "selected" && selectedUserIds.length ? selectedUserIds : undefined
    );
    if (result) {
      setLastResult({
        sent: result.sent,
        failed: result.failed,
        batches: result.batches,
      });
      setConfirmOpen(false);
      setMessage("");
    }
  }, [confirmMatch, message, sendMassSms, recipientMode, selectedUserIds]);

  const handleCloseConfirm = useCallback(() => {
    if (!sendLoading) setConfirmOpen(false);
  }, [sendLoading]);

  useEffect(() => {
    if (!pickerOpen) return;
    // Defer state updates to avoid synchronous setState in effect (react-hooks/set-state-in-effect)
    queueMicrotask(() => {
      setPickerLoading(true);
      setPickerSearch("");
    });
    let cancelled = false;
    supabase
      .from("user_profiles")
      .select("user_id, full_name, email")
      .order("full_name", { ascending: true, nullsFirst: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setPickerUsers([]);
          return;
        }
        setPickerUsers((data ?? []) as SelectedUser[]);
      })
      .then(
        () => { if (!cancelled) setPickerLoading(false); },
        () => { if (!cancelled) setPickerLoading(false); }
      );
    return () => { cancelled = true; };
  }, [pickerOpen]);

  const pickerFiltered = useMemo(() => {
    if (!pickerSearch.trim()) return pickerUsers;
    const q = pickerSearch.toLowerCase().trim();
    return pickerUsers.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [pickerUsers, pickerSearch]);

  const addSelectedUser = useCallback((user: SelectedUser) => {
    setSelectedUsers((prev) =>
      prev.some((p) => p.user_id === user.user_id) ? prev : [...prev, user]
    );
  }, []);

  const pickerModal = pickerOpen
    ? createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sms-picker-title"
        onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-[#f6dcb2]/25 bg-[#14110d] shadow-xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 id="sms-picker-title" className="text-lg font-bold text-white">
              Select recipients
            </h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="p-1.5 rounded-lg text-[#c7b696] hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a5c]" />
              <input
                type="search"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 text-sm text-[#fdf4db] placeholder:text-[#8a7a5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {pickerLoading ? (
              <p className="text-sm text-[#c7b696] py-4 text-center">Loading users…</p>
            ) : (
              <ul className="space-y-1">
                {pickerFiltered.map((u) => {
                  const isSelected = selectedUsers.some((p) => p.user_id === u.user_id);
                  return (
                    <li key={u.user_id}>
                      <button
                        type="button"
                        onClick={() => addSelectedUser(u)}
                        disabled={isSelected}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between ${
                          isSelected
                            ? "bg-[#f4c979]/15 text-[#f4c979] cursor-default"
                            : "text-[#c7b696] hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">
                          {u.full_name || u.email || "No name"}
                          {u.email && u.full_name && (
                            <span className="text-[#8a7a5c] ml-1 truncate">({u.email})</span>
                          )}
                        </span>
                        {isSelected && <span className="text-xs">Added</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="p-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30"
            >
              Done ({selectedUsers.length} selected)
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    )
    : null;

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

  const confirmModal = confirmOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mass-sms-confirm-title"
        onClick={(e) => e.target === e.currentTarget && handleCloseConfirm()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="rounded-2xl border border-[#f6dcb2]/25 bg-[#14110d] shadow-xl max-w-md w-full p-4 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="mass-sms-confirm-title" className="text-lg font-bold text-white">
              Confirm mass SMS
            </h2>
            <button
              type="button"
              onClick={handleCloseConfirm}
              disabled={sendLoading}
              className="p-1.5 rounded-lg text-[#c7b696] hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[#c7b696] mb-3">
            This will send the message to <strong className="text-[#f4c979]">{countWithPhone}</strong> user
            {countWithPhone !== 1 ? "s" : ""}. This cannot be undone.
          </p>
          <p className="text-xs text-[#8a7a5c] mb-2">
            Type <strong>{countWithPhone}</strong> below to enable Send.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={String(countWithPhone)}
            className="w-full rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 py-2.5 text-sm text-[#fdf4db] placeholder:text-[#8a7a5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 mb-4"
            aria-label="Type recipient count to confirm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCloseConfirm}
              disabled={sendLoading}
              className="px-4 py-2 rounded-xl border border-[#f6dcb2]/25 text-sm font-semibold text-[#fdf4db] hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={!confirmMatch || sendLoading}
              className="px-4 py-2 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 flex items-center gap-2"
            >
              {sendLoading ? "Sending…" : isSendToAll ? "Send to all" : `Send to ${countWithPhone} user${countWithPhone !== 1 ? "s" : ""}`}
              <Send className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    );

  return (
    <DashboardLayout title="Mass SMS" pageHeading>
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-6 pb-20 sm:pb-8 pt-2 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] overflow-hidden mb-4 sm:mb-6 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)" }}
          />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
          <div className="relative px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                <MessageSquare className="w-3.5 h-3.5 text-[#f4c979]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">
                  Admin • Broadcast
                </span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
              Mass SMS to All Users
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#c7b696] font-medium max-w-xl">
              Send one message to every app user with a phone number who has not opted out. Use for
              operational or safety-related announcements only.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-3 sm:p-6 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
        >
          {previewLoading && (
            <p className="text-sm text-[#c7b696] mb-4">Loading recipient count…</p>
          )}
          {previewError && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{previewError}</span>
              <button
                type="button"
                onClick={() => (recipientMode === "all" ? refetchPreview() : refetchPreview(selectedUserIds))}
                className="ml-auto text-[#f4c979] hover:underline text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}
          <div className="mb-4">
            <p className="text-xs font-semibold text-[#f4c979]/80 uppercase tracking-wider mb-2">
              Recipients
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setRecipientMode("all")}
                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                  recipientMode === "all"
                    ? "bg-[#f4c979]/20 border border-[#f4c979]/40 text-[#fef3d1]"
                    : "border border-[#f6dcb2]/25 text-[#c7b696] hover:bg-white/5"
                }`}
              >
                <Users className="w-4 h-4" />
                All users with phone
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecipientMode("selected");
                  setPickerOpen(true);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                  recipientMode === "selected"
                    ? "bg-[#f4c979]/20 border border-[#f4c979]/40 text-[#fef3d1]"
                    : "border border-[#f6dcb2]/25 text-[#c7b696] hover:bg-white/5"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Select users
              </button>
            </div>
            {recipientMode === "selected" && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="px-3 py-2 rounded-xl border border-[#f4c979]/30 text-sm font-medium text-[#f4c979] hover:bg-[#f4c979]/10 flex items-center gap-2"
                  data-testid="mass-sms-choose-users"
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                >
                  <UserPlus className="w-4 h-4" />
                  {selectedUsers.length === 0
                    ? "Choose users"
                    : `${selectedUsers.length} selected — change`}
                </button>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedUsers.map((u) => (
                      <span
                        key={u.user_id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-[#c7b696]"
                      >
                        {u.full_name || u.email || u.user_id.slice(0, 8)}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUsers((prev) => prev.filter((p) => p.user_id !== u.user_id))
                          }
                          className="p-0.5 rounded hover:bg-white/10 text-[#8a7a5c]"
                          aria-label={`Remove ${u.full_name || u.email}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!previewLoading && !previewError && preview != null && (
            <>
              <p className="text-sm text-[#c7b696] mb-1">
                <strong className="text-[#f4c979]">{countWithPhone}</strong> user
                {countWithPhone !== 1 ? "s" : ""} will receive this message
                {isSendToAll && totalUsers > 0 && (
                  <span className="text-[#8a7a5c]"> (of {totalUsers} total app users)</span>
                )}
                .
              </p>
              {countWithPhone === 0 && isSendToAll && totalUsers > 0 && (
                <p className="text-xs text-amber-400/90 mb-2">
                  No users have a phone number on file. Phone numbers come from sign-up or can be
                  added in User Management. After adding or backfilling phones, refresh this page.
                </p>
              )}
              {countWithPhone === 0 && recipientMode === "selected" && (
                <p className="text-xs text-amber-400/90 mb-2">
                  Select users above, or none of the selected users have a phone on file.
                </p>
              )}
              {fromNumber && (
                <p className="text-xs text-[#8a7a5c] mb-4">
                  Recipients will see messages from: <span className="text-[#c7b696]">{fromNumber}</span>
                  . Same number as safety briefing reminders.
                </p>
              )}
            </>
          )}

          <label className="block text-xs font-semibold text-[#f4c979]/80 uppercase tracking-wider mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Enter your message…"
            rows={4}
            maxLength={MAX_MESSAGE_LENGTH}
            className="w-full min-w-0 rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 sm:px-4 py-2 sm:py-3 text-sm text-[#fdf4db] placeholder:text-[#8a7a5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 resize-y mb-2"
            aria-describedby="mass-sms-char-desc"
          />
          <p id="mass-sms-char-desc" className="text-xs text-[#8a7a5c] mb-2">
            {message.length} / {MAX_MESSAGE_LENGTH} chars. 160 chars = 1 SMS (GSM-7). Non-GSM characters
            (emoji, curly quotes) use 70 chars per segment and are stripped before send.
          </p>

          {lastResult && (
            <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#c7b696]">
              <p>
                Last send: <strong className="text-emerald-400">{lastResult.sent}</strong> sent,{" "}
                <strong className={lastResult.failed > 0 ? "text-amber-400" : "text-[#c7b696]"}>
                  {lastResult.failed}
                </strong>{" "}
                failed.
                {lastResult.batches?.some((b) => b.error) && (
                  <span className="block mt-1 text-xs text-amber-400">
                    Check batches for errors; you can retry after cooldown.
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={
                previewLoading ||
                previewError != null ||
                !message.trim() ||
                countWithPhone === 0 ||
                sendDisabledByCooldown ||
                sendLoading ||
                (recipientMode === "selected" && selectedUsers.length === 0)
              }
              className="px-4 py-2.5 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSendToAll ? "Send to all" : `Send to ${countWithPhone} user${countWithPhone !== 1 ? "s" : ""}`}
            </button>
            {sendDisabledByCooldown && (
              <span className="text-xs text-amber-400">
                You can send to all again in {cooldownRemaining} min.
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {confirmModal}
      {pickerModal}
    </DashboardLayout>
  );
}

export default AdminMassSms;
