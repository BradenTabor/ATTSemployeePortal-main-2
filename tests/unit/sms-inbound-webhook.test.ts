import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAuthorized,
  parseInboundBody,
  receivedAtFromPayload,
  redactUrl,
  timingSafeEqual,
} from "../../supabase/functions/_shared/inboundWebhookHelpers";
import {
  handleInboundWebhook,
  type InboundWebhookSupabase,
} from "../../supabase/functions/_shared/inboundWebhookHandler";

const INTERNAL = "internal-secret-value-aaaaaaaa";
const SERVICE = "service-role-key-bbbbbbbbbbbb";
const WEBHOOK = "webhook-secret-value-cccccccc";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const PHONE = "+15551234001";

type UserRow = {
  user_id: string;
  phone_number: string;
  sms_operational_opt_out: boolean;
  sms_marketing_opt_out: boolean;
  email: string;
};

type EventRow = {
  provider_message_id: string | null;
  phone_e164?: string;
  keyword?: string;
  received_at?: string;
  applied_operational?: boolean;
  applied_marketing?: boolean;
};

function createMockDb(initial: {
  users: UserRow[];
  events?: EventRow[];
  webhookEnabled?: boolean;
}) {
  const users = structuredClone(initial.users);
  const events: EventRow[] = structuredClone(initial.events ?? []);
  const inserts: Record<string, unknown>[] = [];

  const supabase: InboundWebhookSupabase = {
    from(table: string) {
      const state: {
        mode: "select" | "update" | "insert";
        filters: Record<string, unknown>;
        updateValues?: Record<string, unknown>;
        insertValues?: Record<string, unknown>;
        maybe: boolean;
      } = { mode: "select", filters: {}, maybe: false };

      const runSelect = (): { data: unknown; error: null } => {
        if (table === "app_settings") {
          return {
            data: state.maybe
              ? {
                  value: {
                    enabled: initial.webhookEnabled !== false,
                  },
                }
              : null,
            error: null,
          };
        }
        if (table === "sms_opt_out_events") {
          const mid = state.filters.provider_message_id;
          const hit = events.find((e) => e.provider_message_id === mid) ?? null;
          return {
            data: state.maybe ? (hit ? { id: "existing" } : null) : hit,
            error: null,
          };
        }
        if (table === "app_users") {
          return { data: users, error: null };
        }
        return { data: null, error: null };
      };

      const runUpdate = (): { data: unknown; error: null } => {
        if (table === "app_users" && state.updateValues) {
          const uid = state.filters.user_id;
          const user = users.find((u) => u.user_id === uid);
          if (user) Object.assign(user, state.updateValues);
        }
        return { data: null, error: null };
      };

      const runInsert = (): {
        data: unknown;
        error: { code?: string; message?: string } | null;
      } => {
        const row = state.insertValues as EventRow;
        if (
          row?.provider_message_id &&
          events.some((e) => e.provider_message_id === row.provider_message_id)
        ) {
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }
        events.push(row);
        inserts.push(row as unknown as Record<string, unknown>);
        return { data: row, error: null };
      };

      const api = {
        select() {
          state.mode = "select";
          return api;
        },
        eq(col: string, val: unknown) {
          state.filters[col] = val;
          return api;
        },
        not() {
          return api;
        },
        maybeSingle() {
          state.maybe = true;
          return Promise.resolve(runSelect());
        },
        update(values: Record<string, unknown>) {
          state.mode = "update";
          state.updateValues = values;
          return api;
        },
        insert(values: Record<string, unknown>) {
          state.mode = "insert";
          state.insertValues = values;
          return Promise.resolve(runInsert());
        },
        then(
          onfulfilled?: (v: { data: unknown; error: unknown }) => unknown,
          onrejected?: (e: unknown) => unknown,
        ) {
          const result =
            state.mode === "update" ? runUpdate() : runSelect();
          return Promise.resolve(result).then(onfulfilled, onrejected);
        },
      };

      return api;
    },
  };

  return { supabase, users, events, inserts };
}

const baseSecrets = {
  internalSecret: INTERNAL,
  serviceRoleKey: SERVICE,
  webhookSecret: WEBHOOK,
};

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

describe("timingSafeEqual", () => {
  it("matches equal strings and rejects length/prefix mismatches", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual(null, "abc")).toBe(false);
  });
});

describe("redactUrl", () => {
  it("removes the secret from a URL containing k", () => {
    const url =
      "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=super-secret-value";
    expect(redactUrl(url)).toContain("k=%5BREDACTED%5D");
    expect(redactUrl(url)).not.toContain("super-secret-value");
  });
});

describe("receivedAtFromPayload", () => {
  const fixedNow = () => new Date("2026-09-10T12:00:00.000Z");

  it("parses string unix timestamps to the correct received_at", () => {
    expect(receivedAtFromPayload({ timestamp: "1725984000" }, fixedNow)).toBe(
      new Date(1725984000 * 1000).toISOString(),
    );
  });

  it("falls back to now for implausible timestamps", () => {
    expect(receivedAtFromPayload({ timestamp: "946684800" }, fixedNow)).toBe(
      "2026-09-10T12:00:00.000Z",
    );
    expect(receivedAtFromPayload({ timestamp: "9999999999" }, fixedNow)).toBe(
      "2026-09-10T12:00:00.000Z",
    );
  });
});

describe("parseInboundBody", () => {
  it("parses form-encoded ClickSend fields", () => {
    const result = parseInboundBody(
      "application/x-www-form-urlencoded",
      formBody({
        message_id: "MID-1",
        from: PHONE,
        to: "+18443781444",
        body: "STOP",
        timestamp: "1725984000",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.message_id).toBe("MID-1");
      expect(result.payload.body).toBe("STOP");
      expect(result.payload.timestamp).toBe("1725984000");
    }
  });

  it("returns unparseable_body for garbage", () => {
    expect(parseInboundBody("application/json", "{{{{").ok).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("accepts correct ?k= and rejects wrong or missing", () => {
    const base =
      "https://example.com/functions/v1/clicksend-inbound-webhook";
    expect(
      isAuthorized(new Request(`${base}?k=${WEBHOOK}`, { method: "POST" }), baseSecrets),
    ).toBe(true);
    expect(
      isAuthorized(new Request(`${base}?k=wrong`, { method: "POST" }), baseSecrets),
    ).toBe(false);
    expect(isAuthorized(new Request(base, { method: "POST" }), baseSecrets)).toBe(false);
  });

  it("never opens when CLICKSEND_WEBHOOK_SECRET is unset", () => {
    const base =
      "https://example.com/functions/v1/clicksend-inbound-webhook";
    const unset = { ...baseSecrets, webhookSecret: undefined };
    expect(
      isAuthorized(new Request(`${base}?k=anything`, { method: "POST" }), unset),
    ).toBe(false);
    expect(
      isAuthorized(new Request(`${base}?k=`, { method: "POST" }), {
        ...baseSecrets,
        webhookSecret: "",
      }),
    ).toBe(false);
  });

  it("still accepts header auth with no query param", () => {
    const base =
      "https://example.com/functions/v1/clicksend-inbound-webhook";
    expect(
      isAuthorized(
        new Request(base, {
          method: "POST",
          headers: { "x-internal-key": INTERNAL },
        }),
        baseSecrets,
      ),
    ).toBe(true);
    expect(
      isAuthorized(
        new Request(base, {
          method: "POST",
          headers: { Authorization: `Bearer ${INTERNAL}` },
        }),
        baseSecrets,
      ),
    ).toBe(true);
  });
});

describe("handleInboundWebhook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const userRow = (): UserRow => ({
    user_id: USER_ID,
    phone_number: PHONE,
    sms_operational_opt_out: false,
    sms_marketing_opt_out: false,
    email: "crew@alltts.com",
  });

  async function postStop(opts: {
    contentType: string;
    body: string;
    url?: string;
    headers?: Record<string, string>;
    secrets?: typeof baseSecrets;
    events?: EventRow[];
    now?: () => Date;
  }) {
    const db = createMockDb({ users: [userRow()], events: opts.events });
    const url =
      opts.url ??
      "https://example.com/functions/v1/clicksend-inbound-webhook";
    const res = await handleInboundWebhook(
      new Request(url, {
        method: "POST",
        headers: {
          "content-type": opts.contentType,
          ...(opts.headers ?? { "x-internal-key": INTERNAL }),
        },
        body: opts.body,
      }),
      {
        supabase: db.supabase,
        secrets: opts.secrets ?? baseSecrets,
        now: opts.now,
      },
    );
    return { res, db, json: await res.json() };
  }

  it("form-encoded STOP flips both flags and inserts one sms_opt_out_events row", async () => {
    const { res, db, json } = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body: formBody({
        message_id: "FORM-STOP-1",
        from: PHONE,
        to: "+18443781444",
        body: "STOP",
        timestamp: "1725984000",
      }),
    });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      keyword: "STOP",
      applied_operational: true,
      applied_marketing: true,
    });
    expect(db.users[0]?.sms_operational_opt_out).toBe(true);
    expect(db.users[0]?.sms_marketing_opt_out).toBe(true);
    expect(db.events).toHaveLength(1);
  });

  it("JSON STOP yields the identical result (no regression)", async () => {
    const { res, db, json } = await postStop({
      contentType: "application/json",
      body: JSON.stringify({
        message_id: "JSON-STOP-1",
        from: PHONE,
        to: "+18443781444",
        body: "STOP",
        timestamp: 1725984000,
      }),
    });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      keyword: "STOP",
      applied_operational: true,
      applied_marketing: true,
    });
    expect(db.users[0]?.sms_operational_opt_out).toBe(true);
    expect(db.users[0]?.sms_marketing_opt_out).toBe(true);
    expect(db.events).toHaveLength(1);
  });

  it("correct ?k= authorizes; wrong ?k= and missing → 401", async () => {
    const base =
      "https://example.com/functions/v1/clicksend-inbound-webhook";
    const body = formBody({
      message_id: "AUTH-1",
      from: PHONE,
      body: "STOP",
    });

    const ok = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body,
      url: `${base}?k=${WEBHOOK}`,
      headers: {},
    });
    expect(ok.res.status).toBe(200);

    const wrong = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body,
      url: `${base}?k=wrong`,
      headers: {},
    });
    expect(wrong.res.status).toBe(401);

    const missing = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body,
      url: base,
      headers: {},
    });
    expect(missing.res.status).toBe(401);
  });

  it("CLICKSEND_WEBHOOK_SECRET unset + any ?k= → 401 (never open)", async () => {
    const { res } = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body: formBody({ message_id: "OPEN-1", from: PHONE, body: "STOP" }),
      url: `https://example.com/functions/v1/clicksend-inbound-webhook?k=${WEBHOOK}`,
      headers: {},
      secrets: { ...baseSecrets, webhookSecret: undefined },
    });
    expect(res.status).toBe(401);
  });

  it("header auth still works with no query param present", async () => {
    const { res, json } = await postStop({
      contentType: "application/json",
      body: JSON.stringify({
        message_id: "HDR-1",
        from: PHONE,
        body: "STOP",
      }),
      headers: { "x-internal-key": INTERNAL },
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("duplicate form-encoded POST with same message_id → skipped duplicate", async () => {
    const fields = formBody({
      message_id: "DUP-1",
      from: PHONE,
      body: "STOP",
    });
    const first = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body: fields,
    });
    expect(first.res.status).toBe(200);
    expect(first.json.ok).toBe(true);

    const second = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body: fields,
      events: [{ provider_message_id: "DUP-1" }],
    });
    expect(second.res.status).toBe(200);
    expect(second.json).toEqual({ skipped: true, reason: "duplicate" });
  });

  it("string timestamp is parsed into the correct received_at", async () => {
    const ts = "1725984000";
    const { db } = await postStop({
      contentType: "application/x-www-form-urlencoded",
      body: formBody({
        message_id: "TS-1",
        from: PHONE,
        body: "STOP",
        timestamp: ts,
      }),
      now: () => new Date("2026-09-10T12:00:00.000Z"),
    });
    expect(db.events[0]?.received_at).toBe(new Date(Number(ts) * 1000).toISOString());
  });

  it("garbage body → 200 {skipped: unparseable_body}, NOT 500", async () => {
    const { res, json } = await postStop({
      contentType: "application/json",
      body: "not-json-at-all!!!",
    });
    expect(res.status).toBe(200);
    expect(json).toEqual({ skipped: true, reason: "unparseable_body" });
  });
});
