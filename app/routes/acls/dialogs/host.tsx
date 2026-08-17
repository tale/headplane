import { useEffect, useState } from "react";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";
import { isValidHostName } from "~/utils/acl-policy";

interface HostDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  name?: string;
  value?: string;
  existingNames: string[];
  onSave: (name: string, value: string) => void;
}

export default function HostDialog({
  isOpen,
  setIsOpen,
  name,
  value,
  existingNames,
  onSave,
}: HostDialogProps) {
  const [draftName, setDraftName] = useState(name ?? "");
  const [draftValue, setDraftValue] = useState(value ?? "");

  useEffect(() => {
    if (isOpen) {
      setDraftName(name ?? "");
      setDraftValue(value ?? "");
    }
  }, [isOpen, name, value]);

  const isDuplicate = draftName !== name && existingNames.includes(draftName);
  const nameIsInvalid = !isValidHostName(draftName) || isDuplicate;
  const valueIsInvalid = draftValue.trim().length === 0;

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel
        isDisabled={nameIsInvalid || valueIsInvalid}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draftName, draftValue.trim());
          setIsOpen(false);
        }}
      >
        <Title>{name ? `Edit host ${name}` : "New host"}</Title>
        <Text>
          Hosts give a name to an IP address or CIDR range so it can be referenced from rules.
        </Text>
        <Input
          errorMessage={
            isDuplicate
              ? "A host with this name already exists."
              : "Host names may only contain lowercase letters, numbers and dashes."
          }
          invalid={nameIsInvalid}
          label="Name"
          onChange={setDraftName}
          placeholder="office"
          value={draftName}
        />
        <Input
          invalid={draftValue.length > 0 && valueIsInvalid}
          label="Address"
          onChange={setDraftValue}
          placeholder="100.64.0.0/24"
          value={draftValue}
        />
      </DialogPanel>
    </Dialog>
  );
}
