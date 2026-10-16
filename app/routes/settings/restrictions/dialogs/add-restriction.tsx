import { Plus } from "lucide-react";
import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";
import { fieldValidator } from "~/utils/form";

import { type RestrictionType, restrictionValue } from "../schemas";

const copy = {
  domain: {
    title: "Add domain",
    label: "Domain",
    description: "Only users with an email address at this domain can sign in through OIDC.",
    placeholder: "example.com",
  },
  group: {
    title: "Add group",
    label: "Group",
    description: "Only members of this OIDC group can sign in.",
    placeholder: "admin",
  },
  user: {
    title: "Add user",
    label: "User",
    description: "Only this OIDC user can sign in.",
    placeholder: "john_doe",
  },
};

const validators = {
  domain: fieldValidator(restrictionValue.domain),
  group: fieldValidator(restrictionValue.group),
  user: fieldValidator(restrictionValue.user),
};

interface AddRestrictionProps {
  type: RestrictionType;
}

export default function AddRestriction({ type }: AddRestrictionProps) {
  const [value, setValue] = useState("");
  const { title, label, description, placeholder } = copy[type];
  const domain = value.trim();

  return (
    <ActionDialog
      description={description}
      fields={{ type }}
      intent="add"
      submitLabel={title}
      title={title}
      trigger={
        <Button>
          <Plus className="size-3.5" />
          {title}
        </Button>
      }
    >
      <Input
        description={
          type === "domain" && domain.length > 0 ? `Matches <user>@${domain}` : undefined
        }
        label={label}
        name="value"
        onChange={setValue}
        placeholder={placeholder}
        required
        validate={validators[type]}
      />
    </ActionDialog>
  );
}
