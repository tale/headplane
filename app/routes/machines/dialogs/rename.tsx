import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Code from "~/components/code";
import Input from "~/components/input";
import type { Machine } from "~/types";
import { fieldValidator } from "~/utils/form";

import { machineName } from "../schemas";

interface RenameProps {
  machine: Machine;
  isOpen: boolean;
  magic?: string;
  setIsOpen: (isOpen: boolean) => void;
}

const validateName = fieldValidator(machineName);

export default function Rename({ machine, magic, isOpen, setIsOpen }: RenameProps) {
  const [name, setName] = useState(machine.givenName);
  const isValid = validateName(name) === null;

  return (
    <ActionDialog
      description="This name is shown in the admin panel, in Tailscale clients, and used when generating MagicDNS names."
      fields={{ node_id: machine.id }}
      intent="rename"
      isDisabled={name === machine.givenName}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Rename"
      title={`Rename ${machine.givenName}`}
    >
      <Input
        defaultValue={machine.givenName}
        label="Machine name"
        name="name"
        onChange={setName}
        required
        validate={validateName}
      />
      {magic && isValid && (
        <p className="text-muted">
          {name === machine.givenName ? (
            <>
              Reachable at <Code>{machine.givenName}</Code>.
            </>
          ) : (
            <>
              Will be reachable at <Code>{name.toLowerCase()}</Code>, and{" "}
              <Code>{machine.givenName}</Code> will stop resolving.
            </>
          )}
        </p>
      )}
    </ActionDialog>
  );
}
