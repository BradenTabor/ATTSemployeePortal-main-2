import { useState } from 'react';
import { Edit2, Package, Power, Trash2 } from 'lucide-react';
import {
  CATALOG_CATEGORY_LABELS,
  type AdminCatalogItem,
  type CatalogCategory,
} from '@/types/redemption';

interface AdminCatalogTableProps {
  items: AdminCatalogItem[];
  onEdit: (item: AdminCatalogItem) => void;
  onToggleActive: (item: AdminCatalogItem) => void;
  onDelete: (item: AdminCatalogItem) => void;
  actionLoadingId: string | null;
}

function stockLabel(stock: number | null): string {
  if (stock === null) return 'Unlimited';
  return String(stock);
}

export function AdminCatalogTable({
  items,
  onEdit,
  onToggleActive,
  onDelete,
  actionLoadingId,
}: AdminCatalogTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<AdminCatalogItem | null>(null);

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/50"
        data-testid="admin-catalog-empty"
      >
        No catalog items yet. Add your first reward.
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm" data-testid="admin-catalog-table">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/50">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const categoryLabel =
                CATALOG_CATEGORY_LABELS[item.category as CatalogCategory] ?? item.category ?? '—';
              const busy = actionLoadingId === item.id;

              return (
                <tr
                  key={item.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                  data-testid={`catalog-row-${item.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-white/30" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        {item.redemption_count > 0 ? (
                          <p className="text-xs text-white/40">
                            {item.redemption_count} redemption
                            {item.redemption_count === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white">{item.point_cost} pts</td>
                  <td className="px-4 py-3 text-white/80">{stockLabel(item.stock_qty)}</td>
                  <td className="px-4 py-3 text-white/80">{categoryLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.is_active
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-white/50 border border-white/10'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Edit2 className="w-4 h-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleActive(item)}
                        disabled={busy}
                        className="p-2 rounded-lg text-white/60 hover:text-[#f4c979] hover:bg-white/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                        aria-label={item.is_active ? `Deactivate ${item.name}` : `Activate ${item.name}`}
                      >
                        <Power className="w-4 h-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        disabled={busy}
                        className="p-2 rounded-lg text-white/60 hover:text-red-300 hover:bg-white/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3" data-testid="admin-catalog-cards">
        {items.map((item) => {
          const categoryLabel =
            CATALOG_CATEGORY_LABELS[item.category as CatalogCategory] ?? item.category ?? '—';
          const busy = actionLoadingId === item.id;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              data-testid={`catalog-card-${item.id}`}
            >
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-lg border border-white/10 overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                      <Package className="w-5 h-5 text-white/30" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white truncate">{item.name}</p>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs ${
                        item.is_active ? 'text-emerald-300' : 'text-white/50'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mt-0.5">
                    {item.point_cost} pts · {stockLabel(item.stock_qty)} · {categoryLabel}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/80"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onToggleActive(item)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/80 disabled:opacity-50"
                >
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg border border-red-500/30 text-sm text-red-300 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget ? (
        <DeleteConfirmDialog
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDelete(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

function DeleteConfirmDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: AdminCatalogItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocked = item.redemption_count > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      role="presentation"
      data-testid="catalog-delete-dialog"
    >
      <div
        role="alertdialog"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl"
      >
        <h3 id="delete-dialog-title" className="text-lg font-semibold text-white mb-2">
          {blocked ? 'Cannot delete item' : `Delete ${item.name}?`}
        </h3>
        {blocked ? (
          <p className="text-sm text-white/60 mb-4">
            This item has {item.redemption_count} redemption
            {item.redemption_count === 1 ? '' : 's'} on record. Deactivate it instead to remove it
            from the store while preserving history.
          </p>
        ) : (
          <p className="text-sm text-white/60 mb-4">
            This permanently removes the catalog item. Only use delete for items that were never
            redeemed.
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked ? (
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              data-testid="confirm-delete-catalog-item"
            >
              Delete permanently
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
