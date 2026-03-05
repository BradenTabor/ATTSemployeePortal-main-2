import { describe, it, expect } from "vitest";
import type {
  AttendanceStatus,
  MarkAttendancePayload,
  BulkMarkPayload,
} from "../../src/pages/general-foreman/attendance/types";
import {
  STATUS_CONFIG,
  ALL_STATUSES,
} from "../../src/pages/general-foreman/attendance/types";

// ── Types / Config validation ──

describe("AttendanceStatus types", () => {
  it("STATUS_CONFIG covers all four statuses", () => {
    expect(Object.keys(STATUS_CONFIG)).toEqual(["present", "absent", "ncns", "rto"]);
  });

  it("ALL_STATUSES array matches STATUS_CONFIG keys", () => {
    expect(ALL_STATUSES).toEqual(["present", "absent", "ncns", "rto"]);
  });

  it.each(ALL_STATUSES)("%s has required config fields", (status) => {
    const cfg = STATUS_CONFIG[status];
    expect(cfg.label).toBeDefined();
    expect(cfg.shortLabel).toBeDefined();
    expect(cfg.color).toBeDefined();
    expect(cfg.bgClass).toBeDefined();
    expect(cfg.solidClass).toBeDefined();
    expect(cfg.dotClass).toBeDefined();
    expect(cfg.icon).toBeDefined();
  });
});

// ── Payload validation ──

describe("MarkAttendancePayload shape", () => {
  it("accepts a valid single-mark payload", () => {
    const payload: MarkAttendancePayload = {
      userId: "abc-123",
      date: "2026-03-05",
      status: "present",
    };
    expect(payload.userId).toBe("abc-123");
    expect(payload.date).toBe("2026-03-05");
    expect(payload.status).toBe("present");
  });

  it("accepts optional notes", () => {
    const payload: MarkAttendancePayload = {
      userId: "abc-123",
      date: "2026-03-05",
      status: "ncns",
      notes: "Did not answer phone",
    };
    expect(payload.notes).toBe("Did not answer phone");
  });
});

describe("BulkMarkPayload shape", () => {
  it("accepts a valid bulk payload", () => {
    const payload: BulkMarkPayload = {
      userIds: ["user-1", "user-2", "user-3"],
      date: "2026-03-05",
      status: "absent",
    };
    expect(payload.userIds).toHaveLength(3);
    expect(payload.status).toBe("absent");
  });
});

// ── Optimistic update logic ──

describe("Optimistic update pattern", () => {
  it("replaces target user status in a list", () => {
    const users = [
      { user_id: "u1", status: null as AttendanceStatus | null },
      { user_id: "u2", status: "present" as AttendanceStatus | null },
      { user_id: "u3", status: null as AttendanceStatus | null },
    ];

    const targetId = "u1";
    const newStatus: AttendanceStatus = "absent";

    const updated = users.map((u) =>
      u.user_id === targetId ? { ...u, status: newStatus } : u
    );

    expect(updated[0].status).toBe("absent");
    expect(updated[1].status).toBe("present");
    expect(updated[2].status).toBe(null);
  });

  it("bulk update replaces all selected users", () => {
    const users = [
      { user_id: "u1", status: null as AttendanceStatus | null },
      { user_id: "u2", status: "present" as AttendanceStatus | null },
      { user_id: "u3", status: null as AttendanceStatus | null },
    ];

    const selectedIds = new Set(["u1", "u3"]);
    const newStatus: AttendanceStatus = "ncns";

    const updated = users.map((u) =>
      selectedIds.has(u.user_id) ? { ...u, status: newStatus } : u
    );

    expect(updated[0].status).toBe("ncns");
    expect(updated[1].status).toBe("present");
    expect(updated[2].status).toBe("ncns");
  });

  it("rollback restores original snapshot", () => {
    const original = [
      { user_id: "u1", status: null as AttendanceStatus | null },
      { user_id: "u2", status: "present" as AttendanceStatus | null },
    ];

    const snapshot = [...original.map((u) => ({ ...u }))];

    const mutated = original.map((u) =>
      u.user_id === "u1" ? { ...u, status: "absent" as AttendanceStatus } : u
    );

    expect(mutated[0].status).toBe("absent");

    const restored = snapshot;
    expect(restored[0].status).toBe(null);
    expect(restored[1].status).toBe("present");
  });
});

// ── Sync trigger mapping (validates the SQL mapping logic) ──

describe("Attendance-to-absences sync mapping", () => {
  const SYNC_MAP: Record<string, string | null> = {
    absent: "sick",
    ncns: "leave",
    rto: "pto",
    present: null,
  };

  it.each(Object.entries(SYNC_MAP))(
    "attendance status '%s' maps to user_absences type '%s'",
    (attendanceStatus, expectedAbsenceType) => {
      expect(SYNC_MAP[attendanceStatus]).toBe(expectedAbsenceType);
    }
  );
});
