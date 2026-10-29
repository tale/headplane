import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { guests } from "~/server/db/schema";
import { createGuestService, type GuestResult } from "~/server/guests";

function value<T>(result: GuestResult<T>) {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const input = { email: " Guest@Example.com ", duration: "86400" };
const query = { q: "", status: "all" as const, sort: "created-desc" as const, page: 1 };

describe("guest drafts", () => {
  let db: ReturnType<typeof drizzle>;
  let service: ReturnType<typeof createGuestService>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    db = drizzle(":memory:");
    migrate(db, { migrationsFolder: "./drizzle" });
    service = createGuestService(db);
  });
  afterEach(() => {
    db.$client.close();
    vi.useRealTimers();
  });

  test("creation normalizes the email and persists only a draft, ignoring submitted activation fields", () => {
    const guest = value(
      service.create(
        { ...input, status: "active", expires_at: "2031-01-01", activated_at: "now" },
        "admin-id",
      ),
    );
    expect(value(service.get(guest.id))).toMatchObject({
      email: "guest@example.com",
      status: "draft",
      requested_duration_seconds: 86400,
      requested_expires_at: null,
      activated_at: null,
      expires_at: null,
      revoked_at: null,
      created_by: "admin-id",
      revision: 1,
    });
    vi.advanceTimersByTime(86400 * 1000 * 30);
    expect(value(service.get(guest.id)).status).toBe("draft");
    expect(value(service.get(guest.id)).expires_at).toBeNull();
  });

  test("separate drafts can use the same normalized email", () => {
    const first = value(service.create(input, null));
    const second = value(service.create({ ...input, email: "guest@example.com" }, null));
    expect(first.id).not.toBe(second.id);
    expect(
      value(service.list({ ...query, q: "guest@example.com" })).rows.map((row) => row.id),
    ).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  test.for([
    "",
    "not-an-email",
    "a@",
    "a b@example.com",
    "a\n@example.com",
    `${"a".repeat(250)}@example.com`,
  ])("invalid email %j is refused without saving", (email) => {
    expect(service.create({ ...input, email }, null)).toMatchObject({
      ok: false,
      error: { code: "validation", fields: { email: expect.any(String) } },
    });
    expect(value(service.list(query)).rows).toEqual([]);
  });

  test.for(["0", "-1", "3600", "Infinity", "NaN", "86400.5", "", ["86400", "604800"]])(
    "invalid duration %j is refused",
    (duration) => {
      expect(service.create({ ...input, duration }, null)).toMatchObject({
        ok: false,
        error: { code: "validation", fields: { duration: expect.any(String) } },
      });
    },
  );

  test.for(["86400", "172800", "604800"])(
    "preset %s stores an intention without calculating an effective deadline",
    (duration) => {
      const guest = value(service.create({ ...input, duration }, null));
      expect(guest.requested_duration_seconds).toBe(Number(duration));
      expect(guest.requested_expires_at).toBeNull();
      expect(guest.expires_at).toBeNull();
    },
  );

  test.for([
    "",
    "2029-01-01T12:00",
    "2030-02-30T12:00",
    "2030-13-01T12:00",
    "2030-01-01T00:00",
    "2031-01-01T12:00+02:00",
  ])("invalid custom expiry %j is refused", (requested_expires_at) => {
    expect(
      service.create({ ...input, duration: "custom", requested_expires_at }, null),
    ).toMatchObject({
      ok: false,
      error: { code: "validation", fields: { requested_expires_at: expect.any(String) } },
    });
  });

  test("custom dates and optional preset deadlines are stored as UTC intentions", () => {
    for (const duration of ["custom", "86400"]) {
      const guest = value(
        service.create({ ...input, duration, requested_expires_at: "2031-04-05T12:30" }, null),
      );
      expect(guest.requested_expires_at?.toISOString()).toBe("2031-04-05T12:30:00.000Z");
      expect(guest.requested_duration_seconds).toBe(duration === "custom" ? null : 86400);
      expect(guest.activated_at).toBeNull();
    }
  });

  test("oversized notes, display names, control characters and repeated form fields are refused", () => {
    for (const fields of [
      { notes: "a".repeat(4001) },
      { display_name: "a".repeat(101) },
      { notes: "bad\u0000value" },
      { email: ["a@example.com", "b@example.com"] },
    ]) {
      expect(service.create({ ...input, ...fields }, null)).toMatchObject({
        ok: false,
        error: { code: "validation" },
      });
    }
  });

  test("editing updates the draft, clears optional fields and rejects a stale revision", () => {
    const guest = value(
      service.create({ ...input, notes: "Original", display_name: "Name" }, "creator"),
    );
    vi.advanceTimersByTime(2000);
    const edited = value(
      service.update(guest.id, guest.revision, {
        ...input,
        email: " New@Example.com ",
        notes: "",
        display_name: "",
        duration: "604800",
      }),
    );
    expect(value(service.get(guest.id))).toMatchObject({
      email: "new@example.com",
      notes: null,
      display_name: null,
      requested_duration_seconds: 604800,
      revision: 2,
      created_by: "creator",
      created_at: guest.created_at,
    });
    expect(edited.updated_at.getTime()).toBeGreaterThan(guest.updated_at.getTime());
    expect(service.update(guest.id, 1, input)).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(service.revoke(guest.id, 1)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(value(service.get(guest.id)).email).toBe("new@example.com");
  });

  test("an elapsed planned deadline can be preserved during editing without activating or expiring a draft", () => {
    const fields = { ...input, duration: "custom", requested_expires_at: "2030-01-02T00:00" };
    const guest = value(service.create(fields, null));
    vi.advanceTimersByTime(86400 * 1000 * 2);
    expect(value(service.update(guest.id, 1, { ...fields, notes: "Still planning" })).status).toBe(
      "draft",
    );
    expect(
      service.update(guest.id, 2, { ...fields, requested_expires_at: "2030-01-01T01:00" }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  test("revocation closes a draft permanently and refuses edits and repeat revocations", () => {
    const guest = value(service.create(input, null));
    const revoked = value(service.revoke(guest.id, 1));
    expect(revoked).toMatchObject({
      status: "revoked",
      revision: 2,
      activated_at: null,
      expires_at: null,
      revoked_at: new Date(),
    });
    expect(service.update(guest.id, 2, { ...input, status: "active" })).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(service.revoke(guest.id, 2)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(value(service.get(guest.id))).toEqual(revoked);
  });

  test("missing guests produce a structured error for reads, updates and revocations", () => {
    for (const result of [
      service.get("missing"),
      service.update("missing", 1, input),
      service.revoke("missing", 1),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
    }
  });

  test("search treats SQL wildcards as text and status filters and pagination keep stable ordering", () => {
    const first = value(service.create({ ...input, display_name: "100%_planned" }, null));
    value(service.revoke(first.id, 1));
    for (let i = 0; i < 27; i++) {
      vi.advanceTimersByTime(1000);
      value(
        service.create(
          { ...input, email: `guest${i}@example.com`, display_name: `Visitor ${i}` },
          null,
        ),
      );
    }
    expect(value(service.list({ ...query, q: "%_" })).rows.map((row) => row.id)).toEqual([
      first.id,
    ]);
    expect(value(service.list({ ...query, q: "VISITOR", status: "draft" })).total).toBe(27);
    expect(value(service.list({ ...query, q: "GUEST0@" })).rows.map((row) => row.email)).toEqual([
      "guest0@example.com",
    ]);
    expect(value(service.list({ ...query, status: "revoked" })).rows.map((row) => row.id)).toEqual([
      first.id,
    ]);
    const page1 = value(service.list(query));
    const page2 = value(service.list({ ...query, page: 2 }));
    expect(page1.rows).toHaveLength(25);
    expect(page2.rows).toHaveLength(3);
    expect(
      page1.rows.map((row) => row.id).filter((id) => page2.rows.some((row) => row.id === id)),
    ).toEqual([]);
    expect(value(service.list({ ...query, page: 999 })).page).toBe(2);
    expect(value(service.list({ ...query, sort: "created-asc" })).rows[0].id).toBe(first.id);
    vi.advanceTimersByTime(1000);
    value(service.update(page1.rows[0].id, 1, input));
    expect(value(service.list({ ...query, sort: "updated-desc" })).rows[0].id).toBe(
      page1.rows[0].id,
    );
    expect(value(service.list({ ...query, q: "' OR 1=1 --" })).total).toBe(0);
  });

  test("database constraints reject unsupported lifecycle states and missing duration intentions", () => {
    const guest = value(service.create(input, null));
    for (const status of ["pending", "active", "expired"] as const) {
      expect(() => db.update(guests).set({ status }).run()).toThrow();
    }
    expect(() => db.update(guests).set({ activated_at: new Date() }).run()).toThrow();
    expect(() =>
      db.update(guests).set({ requested_duration_seconds: null, requested_expires_at: null }).run(),
    ).toThrow();
    expect(value(service.get(guest.id)).status).toBe("draft");
  });

  test("database failures are reported without pretending an operation succeeded", () => {
    db.$client.exec("PRAGMA query_only = ON");
    expect(service.create(input, null)).toMatchObject({ ok: false, error: { code: "database" } });
    expect(value(service.list(query)).total).toBe(0);
    db.$client.exec("PRAGMA query_only = OFF");
    expect(value(service.create(input, null)).status).toBe("draft");
  });
});
