import ActionDialog from "~/components/action-dialog";
import Attribute from "~/components/attribute";
import Button from "~/components/button";
import Callout from "~/components/callout";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import Section, { SettingList } from "~/components/section";
import { authContext, guestsContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/detail";
import { editGuestAction, guestData, parseGuestId } from "./actions";
import { guestDate } from "./format";
import GuestDialog from "./guest-dialog";
import { durationItems } from "./schemas";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  await context.get(authContext).requireCapability(request, Capabilities.manage_guests);
  return { guest: guestData(context.get(guestsContext).get(parseGuestId(params.id))) };
}

export const action = editGuestAction;
export const clientAction = toastClientAction;

export default function Page({ loaderData: { guest } }: Route.ComponentProps) {
  return (
    <>
      <Link className="focus-ring text-accent mb-4 inline-block rounded-sm text-sm" to="/guests">
        ← Guests
      </Link>
      <PageHeader
        title={<span className="break-words">{guest.display_name ?? guest.email}</span>}
        description={<span className="break-all">{guest.email}</span>}
        actions={
          guest.status === "draft" && (
            <>
              <GuestDialog key={guest.revision} guest={guest} />
              <ActionDialog
                title="Revoke guest draft?"
                intent="revoke"
                submitLabel="Revoke draft"
                isDestructive
                fields={{ revision: String(guest.revision) }}
                description="This permanently closes the draft. It does not revoke any Headscale user, device, or network access."
                trigger={<Button variant="danger">Revoke draft</Button>}
              />
            </>
          )
        }
      />
      <Callout className="mb-6">
        {guest.status === "revoked"
          ? "This draft was administratively revoked and can no longer be edited."
          : "This is a draft. No invitation has been sent and no VPN access has been provisioned."}
      </Callout>
      <Section
        title="Guest details"
        description="Administrative information stored only in Headplane."
      >
        <SettingList>
          <Attribute name="Status" value={guest.status === "draft" ? "Draft" : "Revoked"} />
          <Attribute name="Display name" value={guest.display_name ?? "—"} />
          <Attribute name="Email" value={guest.email} />
          <Attribute name="Created" value={guestDate(guest.created_at)} />
          <Attribute name="Modified" value={guestDate(guest.updated_at)} />
          <Attribute
            name="Created by"
            value={guest.created_by ?? "API key session (no local account)"}
          />
          {guest.revoked_at && <Attribute name="Revoked" value={guestDate(guest.revoked_at)} />}
        </SettingList>
      </Section>
      <Section title="Administrative notes">
        <p className="text-sm break-words whitespace-pre-wrap">{guest.notes ?? "No notes."}</p>
      </Section>
      <Section
        title="Requested access"
        description="Planning only. Saving a draft starts no access countdown."
      >
        <SettingList>
          <Attribute
            name="Duration"
            value={
              durationItems.find(
                (item) => item.value === String(guest.requested_duration_seconds ?? "custom"),
              )?.label ?? "—"
            }
          />
          <Attribute name="Planned expiry" value={guestDate(guest.requested_expires_at)} />
          <Attribute name="Activated" value="Not provisioned" />
          <Attribute name="Effective expiry" value="Not provisioned" />
          <Attribute
            name="Resources"
            value="0 — resource selection is planned for a future phase"
          />
        </SettingList>
      </Section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="guest details" />;
}
