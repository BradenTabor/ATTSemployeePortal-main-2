# Reference: Edge Function Templates

## Template A — User JWT Auth (Frontend-Facing)

```typescript
// supabase/functions/<function-name>/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();

    // ── Your logic here ──
    // Use supabaseClient for queries (respects RLS as the user)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Template B — Admin Role Check

Extends Template A with a role verification step.

```typescript
// After user validation (from Template A), add:

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const { data: appUser, error: appUserError } = await serviceClient
  .from("app_users")
  .select("role")
  .eq("user_id", user.id)
  .single();

if (appUserError || !appUser || appUser.role !== "admin") {
  return new Response(
    JSON.stringify({ error: "Forbidden: Admin access required" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Now use serviceClient for admin operations (bypasses RLS)
```

For multi-role access, change the check:
```typescript
if (!["admin", "safety_officer"].includes(appUser.role)) {
```

---

## Template C — Internal Secret (Cron/Webhooks)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;
    const internalKey = req.headers.get("x-internal-key");

    if (!internalKey || internalKey !== INTERNAL_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Your cron/worker logic here ──
    // Use serviceClient for all queries (full access)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Template D — Dual Auth (Frontend + Internal)

```typescript
// Combine Templates A and C:

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const internalKey = req.headers.get("x-internal-key");
const isInternal = !!(internalKey && INTERNAL_SECRET && internalKey === INTERNAL_SECRET);

let userId: string;
let serviceClient: ReturnType<typeof createClient>;

if (isInternal) {
  // Internal call — use service role
  serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  userId = "system";
} else {
  // User call — validate JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  userId = user.id;
  serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Now use serviceClient and userId for your logic
```

---

## Frontend Invocation Pattern

```typescript
// In a React hook or component:
const { data, error } = await supabase.functions.invoke<ResponseType>(
  '<function-name>',
  { body: { /* payload */ } }
);

// Check both error levels
if (error) throw new Error(error.message);       // network/invocation error
if (data?.error) throw new Error(data.error);     // application-level error
```

With timeout (for slow functions like AI):
```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Request timeout')), 10000);
});

const result = await Promise.race([
  supabase.functions.invoke('<function-name>', { body: payload }),
  timeoutPromise,
]);
```
