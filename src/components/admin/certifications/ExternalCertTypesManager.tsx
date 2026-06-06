import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Archive, Award, X } from 'lucide-react';
import {
  useExternalCertificationTypes,
  useCreateExternalCertificationType,
  useUpdateExternalCertificationType,
  useWorkerExternalCertifications,
} from '../../../hooks/queries/useExternalCertifications';
import type {
  ExternalCertificationType,
  ExternalCertCategory,
} from '../../../types/externalCertification';
import { EXTERNAL_CERT_CATEGORY_LABELS } from '../../../types/externalCertification';
import { glass } from '../../../lib/glass';
import { toast } from '../../../lib/toast';
import { Z } from "@/lib/zIndex";

interface FormState {
  name: string;
  description: string;
  category: ExternalCertCategory;
  validity_months: string;
  is_required: boolean;
  slug: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  category: 'external',
  validity_months: '',
  is_required: false,
  slug: '',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const CATEGORY_ENTRIES = Object.entries(EXTERNAL_CERT_CATEGORY_LABELS) as [
  ExternalCertCategory,
  string,
][];

function TypeFormModal({
  editing,
  form,
  onChange,
  onSubmit,
  onClose,
  isPending,
}: {
  editing: ExternalCertificationType | null;
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ext-cert-type-modal-title"
      onClick={onClose}
      data-testid="ext-cert-type-modal"
    >
      <div
        className={`${glass.elevated} w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <h3
            id="ext-cert-type-modal-title"
            className="text-base font-semibold text-white"
          >
            {editing ? 'Edit Certification Type' : 'Add Certification Type'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <label
              htmlFor="ect-name"
              className="mb-1 block text-sm font-medium text-white/80"
            >
              Name
            </label>
            <input
              id="ect-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={() => {
                if (!editing) onChange({ slug: slugify(form.name) });
              }}
              className="w-full min-h-[44px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              placeholder="e.g. CDL Class A"
            />
          </div>

          {!editing && (
            <div>
              <label
                htmlFor="ect-slug"
                className="mb-1 block text-sm font-medium text-white/80"
              >
                Slug
              </label>
              <input
                id="ect-slug"
                type="text"
                required
                value={form.slug}
                onChange={(e) => onChange({ slug: slugify(e.target.value) })}
                className="w-full min-h-[44px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white/60 placeholder:text-gray-500 focus-visible:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                placeholder="auto-generated-from-name"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="ect-description"
              className="mb-1 block text-sm font-medium text-white/80"
            >
              Description
            </label>
            <textarea
              id="ect-description"
              rows={3}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              placeholder="Optional description…"
            />
          </div>

          <div>
            <label
              htmlFor="ect-category"
              className="mb-1 block text-sm font-medium text-white/80"
            >
              Category
            </label>
            <select
              id="ect-category"
              value={form.category}
              onChange={(e) =>
                onChange({ category: e.target.value as ExternalCertCategory })
              }
              className="w-full min-h-[44px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white focus-visible:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              {CATEGORY_ENTRIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ect-validity"
              className="mb-1 block text-sm font-medium text-white/80"
            >
              Validity (months)
            </label>
            <input
              id="ect-validity"
              type="number"
              min={1}
              value={form.validity_months}
              onChange={(e) => onChange({ validity_months: e.target.value })}
              className="w-full min-h-[44px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              placeholder="Leave blank for no expiry"
            />
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_required}
              onChange={(e) => onChange({ is_required: e.target.checked })}
              className="h-4 w-4 rounded border-white/30 bg-white/10 text-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            />
            <span className="text-sm text-white/80">
              Required for all workers
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim() || (!editing && !form.slug.trim())}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExternalCertTypesManager() {
  const { data: certTypes, isLoading, error } = useExternalCertificationTypes();
  const { data: allWorkerCerts } = useWorkerExternalCertifications();
  const createType = useCreateExternalCertificationType();
  const updateType = useUpdateExternalCertificationType();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalCertificationType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showArchived, setShowArchived] = useState(false);

  const holderCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cert of allWorkerCerts ?? []) {
      map.set(
        cert.external_certification_type_id,
        (map.get(cert.external_certification_type_id) ?? 0) + 1,
      );
    }
    return map;
  }, [allWorkerCerts]);

  const activeTypes = useMemo(
    () => (certTypes ?? []).filter((t) => t.is_active),
    [certTypes],
  );
  const archivedTypes = useMemo(
    () => (certTypes ?? []).filter((t) => !t.is_active),
    [certTypes],
  );

  const patchForm = useCallback(
    (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch })),
    [],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((t: ExternalCertificationType) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? '',
      category: t.category,
      validity_months: t.validity_months != null ? String(t.validity_months) : '',
      is_required: t.is_required,
      slug: t.slug,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const validityNum = form.validity_months.trim()
      ? parseInt(form.validity_months, 10)
      : null;

    if (editing) {
      updateType.mutate(
        {
          id: editing.id,
          updates: {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            category: form.category,
            validity_months: validityNum,
            is_required: form.is_required,
          } as Parameters<typeof updateType.mutate>[0]['updates'],
        },
        {
          onSuccess: () => {
            toast.success('Certification type updated');
            closeModal();
          },
          onError: (err: Error) =>
            toast.error(err?.message ?? 'Failed to update certification type'),
        },
      );
    } else {
      createType.mutate(
        {
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          validity_months: validityNum,
          is_required: form.is_required,
        },
        {
          onSuccess: () => {
            toast.success('Certification type created');
            closeModal();
          },
          onError: (err: Error) =>
            toast.error(err?.message ?? 'Failed to create certification type'),
        },
      );
    }
  }, [form, editing, createType, updateType, closeModal]);

  const handleArchive = useCallback(
    (t: ExternalCertificationType) => {
      updateType.mutate(
        { id: t.id, updates: { is_active: false } },
        {
          onSuccess: () => toast.success(`"${t.name}" archived`),
          onError: (err: Error) =>
            toast.error(err?.message ?? 'Failed to archive'),
        },
      );
    },
    [updateType],
  );

  if (error) {
    return (
      <div
        className={`${glass.card} p-6 text-center text-red-400`}
        role="alert"
      >
        Failed to load certification types.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white sm:text-lg">
          External Certification Types
        </h3>
        <button
          type="button"
          onClick={openCreate}
          data-testid="ext-cert-types-add"
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Certification Type
        </button>
      </div>

      {isLoading ? (
        <div className={`${glass.subtle} p-6 text-center text-white/70`}>
          Loading…
        </div>
      ) : activeTypes.length === 0 ? (
        <div className={`${glass.subtle} p-6 text-center text-white/70`}>
          No external certification types configured yet.
        </div>
      ) : (
        <ul className="space-y-2 sm:space-y-3" data-testid="ext-cert-types-list">
          {activeTypes.map((t) => {
            const holders = holderCountMap.get(t.id) ?? 0;
            return (
              <li
                key={t.id}
                className={`${glass.card} flex min-h-[44px] flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                    <Award className="h-5 w-5 text-amber-400" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{t.name}</p>
                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                        {EXTERNAL_CERT_CATEGORY_LABELS[t.category]}
                      </span>
                      {t.is_required && (
                        <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
                          Required
                        </span>
                      )}
                      {holders > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          {holders} holder{holders !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60">
                      {t.validity_months
                        ? `Valid for ${t.validity_months} month${t.validity_months !== 1 ? 's' : ''}`
                        : 'No expiry'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(t)}
                    disabled={updateType.isPending}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-amber-500/20 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-50"
                    aria-label={`Archive ${t.name}`}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {archivedTypes.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((p) => !p)}
            className="min-h-[44px] text-sm font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedTypes.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2 opacity-60">
              {archivedTypes.map((t) => (
                <li
                  key={t.id}
                  className={`${glass.subtle} flex min-h-[44px] items-center gap-3 p-3`}
                >
                  <Award
                    className="h-4 w-4 shrink-0 text-white/40"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80 line-through">
                      {t.name}
                    </p>
                    <p className="text-xs text-white/40">
                      {EXTERNAL_CERT_CATEGORY_LABELS[t.category]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modalOpen &&
        createPortal(
          <TypeFormModal
            editing={editing}
            form={form}
            onChange={patchForm}
            onSubmit={handleSubmit}
            onClose={closeModal}
            isPending={createType.isPending || updateType.isPending}
          />,
          document.body,
        )}
    </div>
  );
}
