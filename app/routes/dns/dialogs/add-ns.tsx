import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";
import Switch from "~/components/switch";
import { fieldValidator } from "~/utils/form";

import { nameserver } from "../schemas";

const validateNameserver = fieldValidator(nameserver);

export default function AddNameserver() {
  const [isSplit, setIsSplit] = useState(false);

  return (
    <ActionDialog
      intent="add_ns"
      submitLabel="Add nameserver"
      title="Add nameserver"
      trigger={<Button>Add nameserver</Button>}
    >
      <Input
        description="Use this IPv4 or IPv6 address to resolve names."
        label="Nameserver"
        name="nameserver"
        placeholder="1.2.3.4"
        required
        validate={validateNameserver}
      />
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block font-medium">Restrict to domain</span>
          <span className="text-muted block">
            Split DNS. Only Tailscale 1.8 and later use this nameserver.
          </span>
        </span>
        <Switch checked={isSplit} label="Restrict to domain" onCheckedChange={setIsSplit} />
      </label>
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
