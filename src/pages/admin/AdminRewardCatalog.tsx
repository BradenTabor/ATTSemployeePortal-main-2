import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Plus, Shield, Sparkles, Store } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAdminRewardCatalog,
  useToggleCatalogActive,
  useDeleteCatalogItem,
} from '@/hooks/redemption';
import { CatalogItemFormModal } from '@/components/admin/reward-catalog/CatalogItemFormModal';
import { AdminCatalogTable } from '@/components/admin/reward-catalog/AdminCatalogTable';
import type { AdminCatalogItem } from '@/types/redemption';

export default function AdminRewardCatalog() {
  const { isAdmin } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminCatalogItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data: items = [], isLoading, error } = useAdminRewardCatalog(isAdmin);
  const toggleMutation = useToggleCatalogActive();
  const deleteMutation = useDeleteCatalogItem();

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: AdminCatalogItem) => {
    setEditingItem(item);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingItem(null);
  }, []);

  const handleToggleActive = useCallback(
    async (item: AdminCatalogItem) => {
      setActionError(null);
      setActionLoadingId(item.id);
      try {
        await toggleMutation.mutateAsync({ id: item.id, is_active: !item.is_active });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Unable to update item status.');
      } finally {
        setActionLoadingId(null);
      }
    },
    [toggleMutation],
  );

  const handleDelete = useCallback(
    async (item: AdminCatalogItem) => {
      if (item.redemption_count > 0) return;

      setActionError(null);
      setActionLoadingId(item.id);
      try {
        await deleteMutation.mutateAsync(item.id);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Unable to delete item.');
      } finally {
        setActionLoadingId(null);
      }
    },
    [deleteMutation],
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center" data-testid="admin-access-denied">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Reward Catalog">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-8 pt-4 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" aria-hidden />
              <span className="text-xs font-medium text-[#f4c979]">Admin</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8 text-[#f4c979]" aria-hidden />
              <div>
                <h1 className="text-2xl font-bold text-white">Reward Catalog</h1>
                <p className="text-sm text-white/50 mt-0.5">
                  Manage store items, prices, and images. Deactivate items to retire them from the
                  storefront without losing redemption history.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f4c979] text-black font-medium hover:bg-[#e5ba6a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              data-testid="add-catalog-item"
            >
              <Plus className="w-4 h-4" aria-hidden />
              Add item
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              to="/admin/redemption-fulfillment"
              className="inline-flex items-center gap-1.5 text-[#f4c979]/90 hover:text-[#f4c979] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 rounded"
            >
              <Gift className="w-4 h-4" aria-hidden />
              Redemption fulfillment queue
            </Link>
            <Link
              to="/rewards-store"
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 rounded"
            >
              View employee storefront
            </Link>
          </div>
        </motion.div>

        {actionError ? (
          <p className="mb-4 text-sm text-red-300" role="alert">
            {actionError}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            Unable to load catalog. Please try again.
          </p>
        ) : isLoading ? (
          <div className="space-y-3" data-testid="admin-catalog-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <AdminCatalogTable
            items={items}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            actionLoadingId={actionLoadingId}
          />
        )}

        <CatalogItemFormModal isOpen={formOpen} item={editingItem} onClose={closeForm} />
      </div>
    </DashboardLayout>
  );
}
