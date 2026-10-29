import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { ulid } from "ulidx";
import * as v from "valibot";

import { guestFields, type GuestQuery } from "~/routes/guests/schemas";
import { parseValues, type FormErrors } from "~/utils/form";
import log from "~/utils/log";

import { guests, type Guest } from "./db/schema";
import { err, ok, type Result } from "./result";

export interface GuestError {
  code: "validation" | "not_found" | "conflict" | "database";
  message: string;
  fields?: FormErrors;
}

export type GuestResult<T> = Result<T, GuestError>;
export const GUEST_PAGE_SIZE = 25;

export function createGuestService(db: NodeSQLiteDatabase) {
  function database<T>(operation: () => GuestResult<T>): GuestResult<T> {
    try {
      return operation();
    } catch (error) {
      // Do not log query parameters (administrative notes and email addresses).
      const code = error && typeof error === "object" && "code" in error ? error.code : "unknown";
      log.error("server", "Guest database operation failed (%s)", code);
      return err({ code: "database", message: "Couldn't save or load guests. Try again." });
    }
  }

  function get(id: string): GuestResult<Guest> {
    return database(() => {
      const guest = db.select().from(guests).where(eq(guests.id, id)).get();
      return guest
        ? ok(guest)
        : err({ code: "not_found", message: "This guest no longer exists." });
    });
  }

  function values(input: unknown, existing?: Guest) {
    const parsed = parseValues(v.object(guestFields), input);
    if (!parsed.ok) {
      return err<GuestError>({
        code: "validation",
        message: "Check the guest details.",
        fields: parsed.errors,
      });
    }

    const data = parsed.data;
    const date = data.requested_expires_at ? new Date(`${data.requested_expires_at}Z`) : null;
    if (data.duration === "custom" && !date) {
      return err<GuestError>({
        code: "validation",
        message: "Choose a planned expiry for a custom duration.",
        fields: { requested_expires_at: "Choose a planned expiry for a custom duration." },
      });
    }
    if (
      date &&
      date.getTime() <= Date.now() &&
      date.getTime() !== existing?.requested_expires_at?.getTime()
    ) {
      return err<GuestError>({
        code: "validation",
        message: "Choose a planned expiry in the future.",
        fields: { requested_expires_at: "Choose a planned expiry in the future." },
      });
    }

    return ok({
      email: data.email,
      display_name: data.display_name || null,
      notes: data.notes || null,
      requested_duration_seconds: data.duration === "custom" ? null : Number(data.duration),
      requested_expires_at: date,
    });
  }

  function create(input: unknown, createdBy: string | null): GuestResult<Guest> {
    const parsed = values(input);
    if (!parsed.ok) return parsed;
    return database(() => {
      const now = new Date();
      return ok(
        db
          .insert(guests)
          .values({
            ...parsed.value,
            id: ulid(),
            status: "draft",
            created_at: now,
            updated_at: now,
            created_by: createdBy,
          })
          .returning()
          .get(),
      );
    });
  }

  function change(id: string, revision: number, input?: unknown): GuestResult<Guest> {
    const current = get(id);
    if (!current.ok) return current;
    if (current.value.status !== "draft" || current.value.revision !== revision) {
      return err({
        code: "conflict",
        message: "This guest changed or was revoked. Reload before making changes.",
      });
    }
    const parsed = input === undefined ? ok({}) : values(input, current.value);
    if (!parsed.ok) return parsed;

    return database(() => {
      const now = new Date();
      // Compare-and-swap is one atomic statement, including the status change.
      // A stale edit cannot overwrite a revocation or another administrator's edit.
      const updated = db
        .update(guests)
        .set({
          ...parsed.value,
          ...(input === undefined ? { status: "revoked" as const, revoked_at: now } : {}),
          updated_at: now,
          revision: sql`${guests.revision} + 1`,
        })
        .where(and(eq(guests.id, id), eq(guests.status, "draft"), eq(guests.revision, revision)))
        .returning()
        .get();

      return updated
        ? ok(updated)
        : err({ code: "conflict", message: "This guest changed. Reload before making changes." });
    });
  }

  function list(query: GuestQuery) {
    return database(() => {
      const pattern = `%${query.q.replace(/[!%_]/g, "!$&")}%`;
      const where = and(
        query.status === "all" ? undefined : eq(guests.status, query.status),
        query.q
          ? or(
              sql`${guests.email} LIKE ${pattern} ESCAPE '!'`,
              sql`${guests.display_name} LIKE ${pattern} ESCAPE '!'`,
            )
          : undefined,
      );
      const total = db.select({ total: count() }).from(guests).where(where).get()!.total;
      const pages = Math.max(1, Math.ceil(total / GUEST_PAGE_SIZE));
      const page = Math.min(query.page, pages);
      const column = query.sort.startsWith("updated") ? guests.updated_at : guests.created_at;
      const order = query.sort.endsWith("asc") ? asc : desc;
      const rows = db
        .select()
        .from(guests)
        .where(where)
        .orderBy(order(column), order(guests.id))
        .limit(GUEST_PAGE_SIZE)
        .offset((page - 1) * GUEST_PAGE_SIZE)
        .all();
      return ok({ rows, total, page, pages });
    });
  }

  return {
    create,
    get,
    list,
    update: (id: string, revision: number, input: unknown) => change(id, revision, input),
    revoke: (id: string, revision: number) => change(id, revision),
  };
}

export type GuestService = ReturnType<typeof createGuestService>;
