# Reference: Query Keys Registry Pattern

File: `src/lib/queryKeys.ts`

## How the Registry Works

Every entity gets a key factory that creates stable, hierarchical cache keys. 
This enables precise cache invalidation — you can invalidate all JSA data, 
or just JSAs for a specific employee, without clearing unrelated queries.

## Adding a New Entity

Open `src/lib/queryKeys.ts` and add your entity following this exact shape:

```ts
export const queryKeys = {
  // ... existing entries ...

  <entity>: {
    // Invalidates ALL queries for this entity
    all: ['<entity>'] as const,

    // Lists — used for filtered collection queries
    lists: () => [...queryKeys.<entity>.all, 'list'] as const,
    byStatus: (status: string) => [...queryKeys.<entity>.lists(), { status }] as const,
    byEmployee: (employeeId: string) => [...queryKeys.<entity>.lists(), { employeeId }] as const,
    byDateRange: (start: string, end: string) => [...queryKeys.<entity>.lists(), { start, end }] as const,

    // Single item — used for detail queries
    details: () => [...queryKeys.<entity>.all, 'detail'] as const,
    byId: (id: string) => [...queryKeys.<entity>.details(), id] as const,
  },
} as const;
```

## Invalidation Patterns

```ts
// Invalidate everything for the entity (after create/update/delete)
queryClient.invalidateQueries({ queryKey: queryKeys.<entity>.all });

// Invalidate only the specific item that was updated
queryClient.invalidateQueries({ queryKey: queryKeys.<entity>.byId(id) });

// Invalidate a specific filtered list
queryClient.invalidateQueries({ queryKey: queryKeys.<entity>.byEmployee(userId) });
```

## Existing Entities (as of 2026-02-17)

Check the actual file for the current list — do not rely on this reference being up to date.
Key entities include: `jsa`, `dvir`, `dailyEquipment`, `nearMiss`, `treeFelling`, `rto`, 
`users`, `incidents`, `notifications`.
