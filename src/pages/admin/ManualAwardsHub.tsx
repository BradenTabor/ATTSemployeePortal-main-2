import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  ScrollText,
  Plus,
  Pencil,
  Ban,
  Download,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import {
  useAwarderGrants,
  useGrantAwarder,
  useUpdateAwarderGrant,
  useRevokeAwarderGrant,
  useManualAwardsAuditLog,
} from '../../hooks/queries/useManualAwards';
import { useUsersQuery } from '../../hooks/queries/useUsersQuery';
import {
  MANUAL_AWARD_CATEGORIES,
  MANUAL_AWARD_CATEGORY_LABELS,
  type ManualAwardCategory,
  type PointAwarderGrantWithNames,
} from '../../types/manualAwards';
import { DataExporter, generateFilename } from '../../lib/exportUtils';
import type { ManualAwardAuditRow } from '../../types/manualAwards';

type HubTab = 'grants' | 'audit';

const DEFAULT_CAP = 25;
const DEFAULT_BUDGET = 500;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
}

function ManageAwardersSection() {
  const { user } = useAuth();
  const { data: grants = [], isLoading, isError } = useAwarderGrants();
  const { data: users = [] } = useUsersQuery();
  const grantMutation = useGrantAwarder();
  const updateMutation = useUpdateAwarderGrant();
  const revokeMutation = useRevokeAwarderGrant();

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantCap, setGrantCap] = useState(String(DEFAULT_CAP));
  const [grantBudget, setGrantBudget] = useState(String(DEFAULT_BUDGET));
  const [editingGrant, setEditingGrant] = useState<PointAwarderGrantWithNames | null>(null);
  const [editCap, setEditCap] = useState('');
  const [editBudget, setEditBudget] = useState('');

  const activeGrantUserIds = useMemo(
    () => new Set(grants.filter((g) => !g.revoked_at).map((g) => g.user_id)),
    [grants]
  );

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !grantUserId) return;

    if (activeGrantUserIds.has(grantUserId)) {
      const existing = grants.find((g) => g.user_id === grantUserId && !g.revoked_at);
      if (existing) {
        setEditingGrant(existing);
        setEditCap(String(existing.per_award_cap));
        setEditBudget(String(existing.monthly_budget));
        setShowGrantForm(false);
      }
      return;
    }

    await grantMutation.mutateAsync({
      userId: grantUserId,
      perAwardCap: parseInt(grantCap, 10),
      monthlyBudget: parseInt(grantBudget, 10),
      grantedBy: user.id,
    });
    setShowGrantForm(false);
    setGrantUserId('');
    setGrantCap(String(DEFAULT_CAP));
    setGrantBudget(String(DEFAULT_BUDGET));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrant) return;
    await updateMutation.mutateAsync({
      grantId: editingGrant.id,
      perAwardCap: parseInt(editCap, 10),
      monthlyBudget: parseInt(editBudget, 10),
    });
    setEditingGrant(null);
  };

  const handleRevoke = async (grant: PointAwarderGrantWithNames) => {
    if (!user?.id || grant.revoked_at) return;
    if (!window.confirm(`Revoke award authority for ${grant.awarder_name || grant.awarder_email}?`)) {
      return;
    }
    await revokeMutation.mutateAsync({ grantId: grant.id, revokedBy: user.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#c7b696]">
          Grant manual award authority with per-award caps and monthly budgets.
        </p>
        <button
          type="button"
          onClick={() => setShowGrantForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Grant awarder
        </button>
      </div>

      {showGrantForm && (
        <form
          onSubmit={handleGrant}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
        >
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-xs text-[#c7b696] uppercase tracking-wider">User</label>
              <select
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f0d0a] text-white text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <option value="">Select user…</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name || u.email}
                    {activeGrantUserIds.has(u.user_id) ? ' (active grant)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#c7b696] uppercase tracking-wider">Per-award cap</label>
              <input
                type="number"
                min={1}
                value={grantCap}
                onChange={(e) => setGrantCap(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f0d0a] text-white text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs text-[#c7b696] uppercase tracking-wider">Monthly budget</label>
              <input
                type="number"
                min={1}
                value={grantBudget}
                onChange={(e) => setGrantBudget(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f0d0a] text-white text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>
          </div>
          {grantUserId && activeGrantUserIds.has(grantUserId) && (
            <p role="alert" className="text-sm text-amber-300">
              This user already has an active grant — submit will open edit instead.
            </p>
          )}
          <button
            type="submit"
            disabled={grantMutation.isPending}
            className="px-4 py-2 rounded-xl bg-[#f4c979] text-[#2d1c04] text-sm font-semibold disabled:opacity-60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {grantMutation.isPending ? 'Saving…' : 'Create grant'}
          </button>
        </form>
      )}

      {editingGrant && (
        <form
          onSubmit={handleUpdate}
          className="rounded-2xl border border-[#f4c979]/30 bg-[#f4c979]/5 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-[#fef3d1]">
            Edit grant: {editingGrant.awarder_name || editingGrant.awarder_email}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#c7b696]">Per-award cap</label>
              <input
                type="number"
                min={1}
                value={editCap}
                onChange={(e) => setEditCap(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f0d0a] text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#c7b696]">Monthly budget</label>
              <input
                type="number"
                min={1}
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0f0d0a] text-white text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-xl bg-[#f4c979] text-[#2d1c04] text-sm font-semibold"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditingGrant(null)}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm text-[#c7b696]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#f4c979] animate-spin" aria-hidden />
        </div>
      ) : isError ? (
        <p role="alert" className="text-red-300 text-sm">Failed to load grants.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-[#c7b696]">
                <th className="px-4 py-3">Awarder</th>
                <th className="px-4 py-3">Cap</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Granted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {grants.map((grant) => (
                <tr key={grant.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{grant.awarder_name || 'Unknown'}</p>
                    <p className="text-xs text-[#c7b696]">{grant.awarder_email}</p>
                  </td>
                  <td className="px-4 py-3 text-[#fef3d1]">{grant.per_award_cap}</td>
                  <td className="px-4 py-3 text-[#fef3d1]">{grant.monthly_budget}</td>
                  <td className="px-4 py-3 text-[#c7b696] text-xs">
                    {formatDateTime(grant.granted_at)}
                    {grant.granted_by_name && (
                      <span className="block">by {grant.granted_by_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {grant.revoked_at ? (
                      <span className="text-xs text-red-300/90">
                        Revoked {formatDateTime(grant.revoked_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-300">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!grant.revoked_at && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGrant(grant);
                            setEditCap(String(grant.per_award_cap));
                            setEditBudget(String(grant.monthly_budget));
                          }}
                          className="p-2 rounded-lg text-[#f4c979] hover:bg-[#f4c979]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                          aria-label="Edit grant"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(grant)}
                          disabled={revokeMutation.isPending}
                          className="p-2 rounded-lg text-red-300 hover:bg-red-500/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                          aria-label="Revoke grant"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#c7b696]">
                    No awarder grants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditLogSection() {
  const { user, fullName } = useAuth();
  const { data: users = [] } = useUsersQuery();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState<ManualAwardCategory | ''>('');
  const [awarderId, setAwarderId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, isError } = useManualAwardsAuditLog({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    category: category || undefined,
    awarderId: awarderId || undefined,
    recipientId: recipientId || undefined,
    page,
    pageSize,
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleExportCsv = () => {
    const exporter = new DataExporter<ManualAwardAuditRow>();
    exporter.exportCSV({
      data: rows,
      columns: [
        { header: 'Date', key: 'created_at', format: (v) => formatDateTime(String(v)) },
        { header: 'Awarded By', key: 'awarded_by_name', format: (v, r) => String(v || r.awarded_by_email || '—') },
        { header: 'Recipient', key: 'recipient_name', format: (v, r) => String(v || r.recipient_email || '—') },
        { header: 'Amount', key: 'amount' },
        { header: 'Category', key: 'category', format: (v) => String(v || '—') },
        { header: 'Reason', key: 'reason', format: (v) => String(v || '—') },
      ],
      filename: generateFilename('manual-awards-audit'),
      metadata: {
        reportType: 'Manual Awards Audit Log',
        generatedAt: new Date(),
        exportedBy: fullName || user?.email || 'Admin',
        totalRecords: rows.length,
        filters: {
          dateFrom: dateFrom || 'all',
          dateTo: dateTo || 'all',
          category: category || 'all',
          awarderId: awarderId || 'all',
          recipientId: recipientId || 'all',
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[#c7b696]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#c7b696]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#c7b696]">Category</label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value as ManualAwardCategory | ''); setPage(1); }}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm"
          >
            <option value="">All categories</option>
            {MANUAL_AWARD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{MANUAL_AWARD_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#c7b696]">Awarder</label>
          <select
            value={awarderId}
            onChange={(e) => { setAwarderId(e.target.value); setPage(1); }}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm"
          >
            <option value="">All awarders</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#c7b696]">Recipient</label>
          <select
            value={recipientId}
            onChange={(e) => { setRecipientId(e.target.value); setPage(1); }}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm"
          >
            <option value="">All recipients</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#f4c979]/30 text-sm text-[#fef3d1] hover:bg-[#f4c979]/10 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Download className="w-4 h-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#f4c979] animate-spin" />
        </div>
      ) : isError ? (
        <p role="alert" className="text-red-300 text-sm">Failed to load audit log.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-[#c7b696]">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Awarded by</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Amt</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[#c7b696] text-xs whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{row.awarded_by_name || '—'}</p>
                      <p className="text-xs text-[#c7b696]">{row.awarded_by_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{row.recipient_name || '—'}</p>
                      <p className="text-xs text-[#c7b696]">{row.recipient_email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#f4c979]">+{row.amount}</td>
                    <td className="px-4 py-3 text-[#fef3d1]">
                      {row.category
                        ? MANUAL_AWARD_CATEGORY_LABELS[row.category as ManualAwardCategory] ?? row.category
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#c7b696] max-w-xs truncate" title={row.reason ?? ''}>
                      {row.reason || '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#c7b696]">
                      No manual awards match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-[#c7b696]">
              <span>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ManualAwardsHub() {
  const { role } = useAuth();
  const [tab, setTab] = useState<HubTab>('grants');

  if (role !== 'admin') {
    return (
      <DashboardLayout title="Manual Awards" pageHeading>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <Shield className="w-16 h-16 text-red-400 mb-4" aria-hidden />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">Admin access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Manual Awards" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-8 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-[#f4c979]/20 bg-gradient-to-br from-[#1b1914]/90 to-[#0f0d0a]/80 p-5"
        >
          <h1 className="text-2xl font-black text-[#fef3d1]">Manual Point Awards</h1>
          <p className="mt-1 text-sm text-[#c7b696]">
            Manage awarder grants and review the manual award audit trail.
          </p>
        </motion.div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab('grants')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              tab === 'grants'
                ? 'bg-[#f4c979]/20 border border-[#f4c979]/40 text-[#fef3d1]'
                : 'border border-white/10 text-[#c7b696] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" aria-hidden />
            Manage Awarders
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              tab === 'audit'
                ? 'bg-[#f4c979]/20 border border-[#f4c979]/40 text-[#fef3d1]'
                : 'border border-white/10 text-[#c7b696] hover:text-white'
            }`}
          >
            <ScrollText className="w-4 h-4" aria-hidden />
            Audit Log
          </button>
        </div>

        {tab === 'grants' ? <ManageAwardersSection /> : <AuditLogSection />}
      </div>
    </DashboardLayout>
  );
}
