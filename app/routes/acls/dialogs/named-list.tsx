import { useState } from "react";

import Input from "~/components/input";
import TokenList from "~/components/token-list";
import { isValidGroupName, isValidTagName } from "~/utils/acl-policy";

import EditorDialog from "./editor-dialog";

export type NamedListKind = "group" | "tag";

interface NamedListDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  kind: NamedListKind;
  // Present when editing, absent when creating a new entry.
  name?: string;
  members?: string[];
  existingNames: string[];
  suggestions: string[];
  onSave: (name: string, members: string[]) => void;
}

const COPY = {
  group: {
    title: "group",
    prefix: "group:",
    field: "Members",
    fieldDescription: "Headscale users that belong to this group.",
    empty: "No members yet",
    placeholder: "alice@",
    validate: isValidGroupName,
    hint: "Group names must start with group: and may only contain lowercase letters, numbers and dashes.",
  },
  tag: {
    title: "tag",
    prefix: "tag:",
    field: "Tag owners",
    fieldDescription: "Users and groups allowed to assign this tag to a node.",
    empty: "No owners yet",
    placeholder: "group:ops",
    validate: isValidTagName,
    hint: "Tag names must start with tag: and may only contain lowercase letters, numbers and dashes.",
  },
} as const;

export default function NamedListDialog({
  isOpen,
  setIsOpen,
  kind,
  name,
  members,
  existingNames,
  suggestions,
  onSave,
}: NamedListDialogProps) {
  const copy = COPY[kind];
  const [draftName, setDraftName] = useState(name ?? copy.prefix);
  const [draftMembers, setDraftMembers] = useState<string[]>(() => [...(members ?? [])]);

  const trimmedName = draftName.trim();
  const isDuplicate = trimmedName !== name && existingNames.includes(trimmedName);
  const nameIsInvalid = !copy.validate(trimmedName) || isDuplicate;
  // The field opens pre-filled with the `group:`/`tag:` prefix, which is not a
  // valid name yet. Saving stays blocked, but nothing is flagged until it is edited.
  const isPristine = trimmedName.length === 0 || trimmedName === copy.prefix;
  const showNameError = !isPristine && nameIsInvalid;

  return (
    <EditorDialog
      description={copy.hint}
      isDisabled={nameIsInvalid}
      isOpen={isOpen}
      onSubmit={() => onSave(trimmedName, draftMembers)}
      setIsOpen={setIsOpen}
      submitLabel={name ? `Update ${copy.title}` : `Add ${copy.title}`}
      title={name ? `Edit ${copy.title} ${name}` : `New ${copy.title}`}
    >
      <Input
        errorMessage={isDuplicate ? `A ${copy.title} with this name already exists.` : copy.hint}
        invalid={showNameError}
        label="Name"
        onChange={setDraftName}
        placeholder={`${copy.prefix}example`}
        value={draftName}
      />
      <TokenList
        description={copy.fieldDescription}
        emptyText={copy.empty}
        label={copy.field}
        onChange={setDraftMembers}
        placeholder={copy.placeholder}
        suggestions={suggestions}
        values={draftMembers}
      />
    </EditorDialog>
  );
}
