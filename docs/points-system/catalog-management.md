# Reward Catalog Management (Admin)

Admin CRUD for `reward_catalog` — lets ATTS set real store items, prices, stock, and images without a migration.

## Route

- `/admin/reward-catalog` (admin role only; `ProtectedRoute` + in-page `isAdmin` guard)
- Linked from admin nav alongside **Redemption Fulfillment**

## Fields

| Field | Notes |
|-------|--------|
| `name`, `description` | Display text |
| `point_cost` | Must be > 0. **Not retroactive** — `redemptions.point_cost` snapshots at redeem time |
| `stock_qty` | Blank = unlimited (`NULL`) |
| `category` | `apparel`, `gear`, `gift_card`, `other` |
| `sort_order` | Store sort (ascending) |
| `is_active` | Storefront visibility |
| `image_url` | Optional public URL from Storage |

## Deactivate vs delete

| Action | When | Effect |
|--------|------|--------|
| **Deactivate** (`is_active = false`) | Default “retire” path | Item hidden from storefront; redemption history preserved |
| **Delete** | Only when `redemption_count = 0` | Hard remove; blocked by FK `ON DELETE RESTRICT` if any redemptions exist |

The employee storefront (`useRewardCatalog`) filters `.eq('is_active', true)` — inactive items never appear.

## Image upload (Storage)

- **Bucket:** `safety-rewards` (shared with monthly raffle prize images)
- **Path prefix:** `catalog/{itemId}/` or `catalog/pending/` for new items before save
- **Policies:** `public.is_admin()` required for INSERT/UPDATE/DELETE on `storage.objects` where `bucket_id = 'safety-rewards'` — enforced at Storage RLS, not UI-only
- **Compression:** `compressImage()` via `browser-image-compression` (max ~1 MB, 1200px) before upload
- **URL:** `getPublicUrl()` — bucket is public-read
- Upload failure does not block saving the item; image can be added later

## RLS (table)

- SELECT: active items for all authenticated users; admins see inactive too
- INSERT/UPDATE/DELETE: `public.is_admin()` only

## Hooks

- `useAdminRewardCatalog` — all items + redemption counts
- `useCreateCatalogItem`, `useUpdateCatalogItem`, `useToggleCatalogActive`, `useDeleteCatalogItem`
- `useUploadCatalogImage` — Storage upload helper
