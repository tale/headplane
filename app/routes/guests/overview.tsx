import { Form, useNavigation } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Chip from "~/components/chip";
import { controlClass } from "~/components/field";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { Table, TableBody, TableCell, TableHeader } from "~/components/table";
import { authContext, guestsContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { parseValues } from "~/utils/form";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { createGuestAction, guestData } from "./actions";
import { guestDate } from "./format";
import GuestDialog from "./guest-dialog";
import { guestQuery } from "./schemas";

export async function loader({ request, context }: Route.LoaderArgs) {
  await context.get(authContext).requireCapability(request, Capabilities.manage_guests);
  const parsed = parseValues(guestQuery, Object.fromEntries(new URL(request.url).searchParams));
  const query = parsed.ok
    ? parsed.data
    : { q: "", status: "all" as const, sort: "created-desc" as const, page: 1 };
  return {
    ...guestData(context.get(guestsContext).list(query)),
    query,
    queryError: parsed.ok ? undefined : "Invalid search options. Showing all guests.",
  };
}

export const action = createGuestAction;
export const clientAction = toastClientAction;

export default function Page({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, pages, query, queryError } = loaderData;
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const pageLink = (next: number) => `?${new URLSearchParams({ ...query, page: String(next) })}`;

  return (
    <>
      <PageHeader
        title="Guests"
        description="Prepare and manage guest requests. Drafts grant no VPN access and send no invitations."
        actions={<GuestDialog />}
      />
      {queryError && (
        <Callout className="mb-4" variant="error">
          {queryError}
        </Callout>
      )}
      <Form
        key={`${query.q}-${query.status}-${query.sort}`}
        method="get"
        role="search"
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
          Search guests
          <input
            className={`${controlClass} px-2.5`}
            name="q"
            type="search"
            placeholder="Name or email"
            maxLength={254}
            defaultValue={query.q}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor="guest-status">Status</label>
          <select
            id="guest-status"
            name="status"
            defaultValue={query.status}
            className={`${controlClass} px-2.5`}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor="guest-sort">Sort by</label>
          <select
            id="guest-sort"
            name="sort"
            defaultValue={query.sort}
            className={`${controlClass} px-2.5`}
          >
            <option value="created-desc">Newest created</option>
            <option value="created-asc">Oldest created</option>
            <option value="updated-desc">Recently modified</option>
            <option value="updated-asc">Least recently modified</option>
          </select>
        </div>
        <Button type="submit" pending={pending}>
          Apply
        </Button>
        <Link to="/guests" className="focus-ring text-accent rounded-sm px-2 py-1 text-sm">
          Clear
        </Link>
      </Form>
      <div aria-busy={pending}>
        <p className="text-muted mb-3 text-sm" role="status">
          {pending ? "Loading guests…" : `${total} guest${total === 1 ? "" : "s"}`}
        </p>
        {rows.length === 0 ? (
          <div className="border-line rounded-lg border px-6 py-12 text-center">
            <h2 className="font-semibold">
              {query.q || query.status !== "all" ? "No matching guests" : "No guests yet"}
            </h2>
            <p className="text-muted mt-2 text-sm">
              {query.q || query.status !== "all"
                ? "Adjust the search or clear the filters."
                : "Use Add Guest to prepare the first draft. No network access will be granted."}
            </p>
          </div>
        ) : (
          <Table className="relative">
            <caption className="sr-only">Guest requests. All dates are shown in UTC.</caption>
            <thead>
              <tr>
                {[
                  "Name",
                  "Email",
                  "Status",
                  "Created",
                  "Planned expiry",
                  "Resources",
                  "Modified",
                  "Actions",
                ].map((label) => (
                  <TableHeader key={label} scope="col">
                    {label}
                  </TableHeader>
                ))}
              </tr>
            </thead>
            <TableBody>
              {rows.map((guest) => (
                <tr key={guest.id}>
                  <TableCell className="min-w-40">
                    <Link
                      to={`/guests/${guest.id}`}
                      className="focus-ring text-accent rounded-sm break-words"
                    >
                      {guest.display_name ?? "Unnamed guest"}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-48 break-all">{guest.email}</TableCell>
                  <TableCell>
                    <Chip
                      text={guest.status === "draft" ? "Draft" : "Revoked"}
                      variant={guest.status === "revoked" ? "bad" : "neutral"}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{guestDate(guest.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {guestDate(guest.requested_expires_at)}
                  </TableCell>
                  <TableCell>0</TableCell>
                  <TableCell className="whitespace-nowrap">{guestDate(guest.updated_at)}</TableCell>
                  <TableCell>
                    <Link to={`/guests/${guest.id}`} className="focus-ring text-accent rounded-sm">
                      View<span className="sr-only"> {guest.display_name ?? guest.email}</span>
                    </Link>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
        {pages > 1 && (
          <nav
            aria-label="Guest pagination"
            className="mt-4 flex items-center justify-between gap-4 text-sm"
          >
            {page > 1 ? (
              <Link to={pageLink(page - 1)} className="focus-ring text-accent">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link to={pageLink(page + 1)} className="focus-ring text-accent">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="guests" />;
}
