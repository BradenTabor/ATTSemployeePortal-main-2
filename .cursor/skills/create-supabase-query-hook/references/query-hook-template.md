# Reference: Query Hook Template

File: `src/hooks/<domain>/use<Entity>.ts` or `src/hooks/queries/use<Entity>.ts`

## Standard List Query (most common)

```typescript
// src/hooks/queries/use<Entity>List.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import type { Database } from '@/types/supabase';

type <Entity>Row = Database['public']['Tables']['<table>']['Row'];

export interface <Entity> {
  id: string;
  // camelCase app fields
  createdAt: Date;
}

function to<Entity>(row: <Entity>Row): <Entity> {
  return {
    id: row.id,
    // map fields
    createdAt: new Date(row.created_at),
  };
}

interface Use<Entity>ListParams {
  employeeId?: string;
  // add other filter params
}

export function use<Entity>List({ employeeId }: Use<Entity>ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.<entity>.byEmployee(employeeId ?? ''),
    queryFn: async (): Promise<<Entity>[]> => {
      let query = supabase
        .from('<table>')
        .select('*')
        .order('created_at', { ascending: false });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      return (data ?? []).map(to<Entity>);
    },
    enabled: !!employeeId,  // don't fire if employeeId is undefined
    staleTime: 5 * 60 * 1000,  // 5 minutes — remove for frequently-updated data
  });
}
```

## Single Item Query

```typescript
export function use<Entity>(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.<entity>.byId(id ?? ''),
    queryFn: async (): Promise<<Entity>> => {
      const { data, error } = await supabase
        .from('<table>')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw new Error(error.message);
      return to<Entity>(data);
    },
    enabled: !!id,
  });
}
```

## With Related Data (join)

```typescript
// Use .select() with a Supabase join string — don't do multiple queries
const { data, error } = await supabase
  .from('<table>')
  .select(`
    *,
    employee:profiles(id, full_name, role),
    photos:form_photos(url, uploaded_at)
  `)
  .eq('id', id!)
  .single();
```

## Notes
- Return type should ALWAYS be the app type, never the DB row type
- `enabled: !!param` prevents the query firing with undefined — always include for auth-dependent hooks
- `staleTime` of 5 minutes is appropriate for safety forms and reports; omit for dashboard counts or live data
