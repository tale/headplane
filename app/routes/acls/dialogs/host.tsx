import { useState } from "react";

import Input from "~/components/input";
import { isValidHostName } from "~/utils/acl-policy";

import EditorDialog from "./editor-dialog";

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

  const isDuplicate = draftName !== name && existingNames.includes(draftName);
  const nameIsInvalid = !isValidHostName(draftName) || isDuplicate;
  const valueIsInvalid = draftValue.trim().length === 0;

  return (
    <EditorDialog
      description="Hosts give a name to an IP address or CIDR range so it can be referenced from rules."
      isDisabled={nameIsInvalid || valueIsInvalid}
      isOpen={isOpen}
      onSubmit={() => onSave(draftName, draftValue.trim())}
      setIsOpen={setIsOpen}
      submitLabel={name ? "Update host" : "Add host"}
      title={name ? `Edit host ${name}` : "New host"}
    >
      <Input
        errorMessage={
          isDuplicate
            ? "A host with this name already exists."
            : "Host names may only contain lowercase letters, numbers and dashes."
        }
        invalid={draftName.length > 0 && nameIsInvalid}
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
    </EditorDialog>
  );
}
