import { Field as BaseField } from "@base-ui/react/field";
import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Field, { controlClass } from "~/components/field";
import Input from "~/components/input";
import Select from "~/components/select";
import type { Guest } from "~/server/db/schema";
import { fieldValidator } from "~/utils/form";

import { durationItems, guestFields, plannedExpiry } from "./schemas";

export default function GuestDialog({ guest }: { guest?: Guest }) {
  const [duration, setDuration] = useState<string | null>(
    guest ? String(guest.requested_duration_seconds ?? "custom") : "86400",
  );
  const existingExpiry = guest?.requested_expires_at?.toISOString().slice(0, 16) ?? "";

  return (
    <ActionDialog
      title={guest ? "Edit guest draft" : "Add Guest"}
      description="Prepare a guest without granting VPN access. No invitation is sent. Multiple drafts may use the same email address."
      intent={guest ? "update" : "create"}
      fields={guest ? { revision: String(guest.revision) } : undefined}
      submitLabel={guest ? "Save changes" : "Create draft"}
      trigger={
        <Button variant={guest ? "secondary" : "primary"}>
          {guest ? "Edit draft" : "Add Guest"}
        </Button>
      }
    >
      <Input
        label="Email"
        name="email"
        type="email"
        required
        maxLength={254}
        defaultValue={guest?.email}
        validate={fieldValidator(guestFields.email)}
      />
      <Input
        label="Display name"
        name="display_name"
        maxLength={100}
        defaultValue={guest?.display_name ?? ""}
        validate={fieldValidator(guestFields.display_name)}
      />
      <Field label="Administrative notes" name="notes" validate={fieldValidator(guestFields.notes)}>
        <BaseField.Control
          render={<textarea />}
          className={`${controlClass} h-24 resize-y px-2.5 py-2`}
          maxLength={4000}
          defaultValue={guest?.notes ?? ""}
        />
      </Field>
      <Select
        label="Requested access duration"
        name="duration"
        items={durationItems}
        value={duration}
        onValueChange={setDuration}
        required
        description="This duration starts only after a future activation. Saving a draft starts no countdown."
      />
      <Input
        label="Planned expiry (UTC)"
        name="requested_expires_at"
        type="datetime-local"
        required={duration === "custom"}
        defaultValue={existingExpiry}
        description="Optional for preset durations. This is a requested deadline, not an effective network expiry."
        validate={(value) => {
          const error = fieldValidator(plannedExpiry)(value);
          if (error) return error;
          if (!value && duration === "custom")
            return "Choose a planned expiry for a custom duration.";
          if (
            typeof value === "string" &&
            value &&
            value !== existingExpiry &&
            new Date(`${value}Z`).getTime() <= Date.now()
          ) {
            return "Choose a planned expiry in the future.";
          }
          return null;
        }}
      />
    </ActionDialog>
  );
}
