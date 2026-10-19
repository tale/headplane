import { Plus } from "lucide-react";
import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";
import { SwitchField } from "~/components/switch";
import { fieldValidator } from "~/utils/form";

import { nameserver } from "../schemas";

const validateNameserver = fieldValidator(nameserver);

export default function AddNameserver() {
  const [isSplit, setIsSplit] = useState(false);

  return (
    <ActionDialog
      intent="add_ns"
      onOpenChange={(isOpen) => isOpen && setIsSplit(false)}
      submitLabel="Add nameserver"
      title="Add nameserver"
      trigger={
        <Button>
          <Plus className="size-3.5" />
          Add nameserver
        </Button>
      }
    >
      <Input
        description="Use this IPv4 or IPv6 address to resolve names."
        label="Nameserver"
        name="nameserver"
        placeholder="1.2.3.4"
        required
        validate={validateNameserver}
      />
      <SwitchField
        checked={isSplit}
        description="Split DNS. Only Tailscale 1.8 and later use this nameserver."
        label="Restrict to domain"
        onCheckedChange={setIsSplit}
      />
      {isSplit && (
        <Input
          description="Only queries for this domain and its subdomains use the nameserver."
          label="Domain"
          name="split_domain"
          placeholder="example.com"
          required
        />
      )}
    </ActionDialog>
  );
}
