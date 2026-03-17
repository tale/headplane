import { useState } from "react";

import Code from "~/components/code";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";
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
          required
          label="Machine name"
          name="name"
          onChange={setName}
          placeholder="Machine name"
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
