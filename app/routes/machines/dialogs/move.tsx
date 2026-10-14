import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Select from "~/components/select";
import type { Machine, User } from "~/types";
import { getUserDisplayName, sortUsersByDisplayName } from "~/utils/user";

interface MoveProps {
  machine: Machine;
  users: User[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Move({ machine, users, isOpen, setIsOpen }: MoveProps) {
  const [userId, setUserId] = useState(machine.user?.id ?? null);

  return (
    <ActionDialog
      description="The owner is the user the machine belongs to."
      fields={{ node_id: machine.id }}
      intent="reassign"
      isDisabled={!userId || userId === machine.user?.id}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Change owner"
      title={`Change owner of ${machine.givenName}`}
    >
      <Select
        defaultValue={machine.user?.id ?? null}
        items={sortUsersByDisplayName(users).map((user) => ({
          value: user.id,
          label: getUserDisplayName(user),
        }))}
        label="Owner"
        name="user_id"
        onValueChange={setUserId}
        placeholder="Select a user"
        required
      />
    </ActionDialog>
  );
}
