import { useState } from "react";

import Code from "~/components/Code";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Text from "~/components/Text";
import Title from "~/components/Title";
import type { Machine } from "~/types";

interface RenameProps {
  machine: Machine;
  isOpen: boolean;
  magic?: string;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Rename({ machine, magic, isOpen, setIsOpen }: RenameProps) {
  const [name, setName] = useState(machine.givenName);

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel>
        <Title>Edit machine name for {machine.givenName}</Title>
        <Text className="mb-6">
          This name is shown in the admin panel, in Tailscale clients, and used when generating
          MagicDNS names.
        </Text>
        <input name="action_id" type="hidden" value="rename" />
        <input name="node_id" type="hidden" value={machine.id} />
        <Input
          defaultValue={machine.givenName}
          isRequired
          label="Machine name"
          name="name"
          onChange={setName}
          placeholder="Machine name"
          validate={(value) => {
            if (value.length === 0) {
              return "Cannot be empty";
            }

            // DNS hostname validation
            if (value.toLowerCase() !== value) {
              return "Cannot contain uppercase letters";
            }

            if (value.length > 63) {
              return "DNS hostnames cannot be 64+ characters";
            }

            // Test for invalid characters
            if (!/^[a-z0-9-]+$/.test(value)) {
              return "Cannot contain special characters";
            }

            // Test for leading/trailing hyphens
            if (value.startsWith("-") || value.endsWith("-")) {
              return "Cannot start or end with a hyphen";
            }

            // Test for consecutive hyphens
            if (value.includes("--")) {
              return "Cannot contain consecutive hyphens";
            }
          }}
          validationBehavior="native"
        />
        {magic ? (
          name.length > 0 && name !== machine.givenName ? (
            <p className="mt-2 text-sm leading-tight text-mist-600 dark:text-mist-300">
              This machine will be accessible by the hostname{" "}
              <Code className="text-sm">{name.toLowerCase().replaceAll(/\s+/g, "-")}</Code>
              {". "}
              The hostname <Code className="text-sm">{machine.givenName}</Code> will no longer point
              to this machine.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-tight text-mist-600 dark:text-mist-300">
              This machine is accessible by the hostname{" "}
              <Code className="text-sm">{machine.givenName}</Code>.
            </p>
          )
        ) : undefined}
      </DialogPanel>
    </Dialog>
  );
}
