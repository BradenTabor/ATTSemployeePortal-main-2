import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Loader2, Package, X } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { Z } from '@/lib/zIndex';
import {
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useUploadCatalogImage,
  type CatalogItemInput,
} from '@/hooks/redemption';
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  type AdminCatalogItem,
  type CatalogCategory,
} from '@/types/redemption';

interface CatalogItemFormModalProps {
  isOpen: boolean;
  item?: AdminCatalogItem | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  point_cost: string;
  stock_qty: string;
  category: CatalogCategory;
  sort_order: string;
  is_active: boolean;
  image_url: string | null;
}

function toFormState(item?: AdminCatalogItem | null): FormState {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    point_cost: item ? String(item.point_cost) : '',
    stock_qty: item?.stock_qty != null ? String(item.stock_qty) : '',
    category: (item?.category as CatalogCategory) ?? 'gear',
    sort_order: item ? String(item.sort_order) : '0',
    is_active: item?.is_active ?? true,
    image_url: item?.image_url ?? null,
  };
}

function buildInput(form: FormState): CatalogItemInput {
  const pointCost = parseInt(form.point_cost, 10);
  const sortOrder = parseInt(form.sort_order, 10);
  const stockRaw = form.stock_qty.trim();

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    point_cost: pointCost,
    stock_qty: stockRaw === '' ? null : parseInt(stockRaw, 10),
    category: form.category,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: form.is_active,
    image_url: form.image_url,
  };
}

export function CatalogItemFormModal({ isOpen, item, onClose }: CatalogItemFormModalProps) {
  const isEdit = !!item;
  const { modalRef } = useModalOverlay({ isOpen, onClose, zIndex: Z.modal });
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadImage } = useUploadCatalogImage();
  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();

  const [form, setForm] = useState<FormState>(() => toFormState(item));
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      setForm(toFormState(item));
      setError(null);
      setImageError(null);
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset mutations only on open
  }, [isOpen, item]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setImageError(null);
      try {
        const url = await uploadImage(file, item?.id);
        setField('image_url', url);
      } catch {
        setImageError('Image upload failed. You can save without an image and try again later.');
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [item?.id, setField, uploadImage],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    const pointCost = parseInt(form.point_cost, 10);
    if (!Number.isFinite(pointCost) || pointCost <= 0) {
      setError('Point cost must be greater than zero.');
      return;
    }

    const stockRaw = form.stock_qty.trim();
    if (stockRaw !== '') {
      const stock = parseInt(stockRaw, 10);
      if (!Number.isFinite(stock) || stock < 0) {
        setError('Stock must be blank (unlimited) or a non-negative number.');
        return;
      }
    }

    const input = buildInput(form);

    try {
      if (isEdit && item) {
        await updateMutation.mutateAsync({ id: item.id, ...input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save catalog item.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ zIndex: Z.modal }}
        role="presentation"
      >
        <div className="absolute inset-0 bg-black/70" onClick={saving ? undefined : onClose} />
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="catalog-item-form-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl"
          data-testid="catalog-item-form-modal"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-900/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#f4c979]" aria-hidden />
              <h2 id="catalog-item-form-title" className="text-lg font-semibold text-white">
                {isEdit ? 'Edit catalog item' : 'Add catalog item'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {isEdit ? (
              <p className="text-xs text-white/50 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                Changing point cost affects only future redemptions. Past requests keep the price
                they were redeemed at.
              </p>
            ) : null}

            <div>
              <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-name">
                Name
              </label>
              <input
                id="catalog-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-description">
                Description
              </label>
              <textarea
                id="catalog-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-cost">
                  Point cost
                </label>
                <input
                  id="catalog-cost"
                  type="number"
                  min={1}
                  value={form.point_cost}
                  onChange={(e) => setField('point_cost', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-stock">
                  Stock (blank = unlimited)
                </label>
                <input
                  id="catalog-stock"
                  type="number"
                  min={0}
                  value={form.stock_qty}
                  onChange={(e) => setField('stock_qty', e.target.value)}
                  placeholder="Unlimited"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white placeholder:text-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-category">
                  Category
                </label>
                <select
                  id="catalog-category"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value as CatalogCategory)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  {CATALOG_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATALOG_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1" htmlFor="catalog-sort">
                  Sort order
                </label>
                <input
                  id="catalog-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setField('sort_order', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                />
              </div>
            </div>

            {isEdit ? (
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                  className="rounded border-white/20"
                />
                Active in store
              </label>
            ) : null}

            <div>
              <span className="block text-xs text-white/60 mb-2">Image (optional)</span>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden flex items-center justify-center">
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-white/30" aria-hidden />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || saving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#f4c979]/30 bg-[#f4c979]/10 text-sm text-[#f4c979] hover:bg-[#f4c979]/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="w-4 h-4" aria-hidden />
                  )}
                  {uploading ? 'Uploading…' : 'Upload image'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              {imageError ? (
                <p className="mt-2 text-xs text-amber-300" role="alert">
                  {imageError}
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f4c979] text-black font-medium hover:bg-[#e5ba6a] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                {isEdit ? 'Save changes' : 'Create item'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
