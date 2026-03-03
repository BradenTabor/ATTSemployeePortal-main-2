---
name: create-supabase-query-hook
description: Scaffold a TanStack React Query hook for Supabase data fetching in ATTS, including query key registration in the central registry, TypeScript type mapping, error handling with parseFormError, enabled conditions, and barrel export update.
triggers:
  - "create a query hook"
  - "add data fetching"
  - "new useQuery hook"
  - "fetch from supabase"
  - "read data from"
  - "list of"
  - "get all"
version: 1.0
reviewed: 2026-02-17
---

# Create Supabase Query Hook

## Purpose
Adds a new TanStack React Query hook that fetches data from Supabase, following the established pattern used by the 25+ existing hooks in `src/hooks/queries/`. Consistent structure is critical for cache invalidation and predictable loading states across the app.

## Pre-Flight Checklist
Before writing any files, collect:
- [ ] `<Entity>` — PascalCase name for the data being fetched (e.g., `SafetyIncident`)
- [ ] `<table>` — Supabase table name in snake_case (e.g., `safety_incidents`)
- [ ] Filter type — what parameters does this query accept? (userId, dateRange, status, etc.)
- [ ] Return shape — single item, list, or paginated?
- [ ] `enabled` condition — when should the query NOT fire? (e.g., when userId is undefined)
- [ ] Domain folder — does `src/hooks/<domain>/` already exist, or is this a new domain?

---

## Step-by-Step Workflow

### Step 1 — Register the Query Key

Open `src/lib/queryKeys.ts` and add the new entity's keys.

See `references/query-keys-pattern.md` for the full registry pattern.

Rules:
- Follow the exact `{ all, byId, byFilter }` shape used by existing entries
- `all` should be a stable array that other invalidation calls can target: `['<entity>']`
- Never hardcode query keys in hook files — always import from `queryKeys`

### Step 2 — Define the Type Mapping

If a mapper function doesn't exist yet for this entity, create it in the hook file (or in `src/lib/mappers/<entity>.ts` if it will be reused):

```ts
// at the top of the hook file, or in src/lib/mappers/<entity>.ts
import type { Database } from '@/types/supabase';

type <Entity>Row = Database['public']['Tables']['<table>']['Row'];

export interface <Entity> {
  id: string;
  // ... application-friendly field names (camelCase)
  createdAt: Date;     // convert string timestamps to Date objects here
}

function to<Entity>(row: <Entity>Row): <Entity> {
  return {
    id: row.id,
    // ... map snake_case DB columns to camelCase app fields
    createdAt: new Date(row.created_at),
  };
}
```

### Step 3 — Write the Hook

See `references/query-hook-template.md` for the full template.

Key rules:
- Use `queryKeys.<entity>.by<Filter>(params)` — never a raw array
- Always gate with `enabled: !!<required_param>` for nullable params
- Always call `.select('*')` explicitly — don't rely on defaults
- Map rows through `to<Entity>()` — never return raw DB rows to components
- Handle errors with `if (error) throw new Error(error.message)` — this feeds React Query's error state
- Use `staleTime: 5 * 60 * 1000` (5 minutes) for data that doesn't change often; omit for frequently-updated data

### Step 4 — Update the Barrel Export

Add the new hook to `src/hooks/<domain>/index.ts`:

```ts
export { use<Entity> } from './use<Entity>';
```

If this is a query hook in `src/hooks/queries/`, also check if `src/hooks/queries/index.ts` needs updating.

---

## After Creation — Validation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Query key is registered in `queryKeys.ts` before the hook uses it
- [ ] `enabled` condition prevents firing when required params are absent
- [ ] Rows are mapped through `to<Entity>()` — no raw DB types leaking to components
- [ ] Hook is exported from the domain barrel
- [ ] Search for any existing `invalidateQueries` calls that might need the new key added

---

## Mutation Hooks (useInsert, useUpdate, useDelete)

If you need a mutation (not just a read), the pattern differs slightly:

```ts
export function useCreate<Entity>() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: <Entity>Insert) => {
      const { data, error } = await supabase
        .from('<table>')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return to<Entity>(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.<entity>.all });
    },
    onError: (err) => {
      logger.error('Failed to create <Entity>', { error: err });
    },
  });
}
```

Always invalidate `queryKeys.<entity>.all` on success — this keeps list queries fresh.

---

## Anti-Patterns — Never Do These

- **Never** call `supabase` directly from a component — always via a hook
- **Never** use raw string arrays as query keys — always use `queryKeys.*`
- **Never** return raw `<Entity>Row` types to components — always map to the app type
- **Never** skip `enabled` for hooks that depend on auth — this causes 401 errors on page load
- **Never** add `retry: false` without a comment explaining why
