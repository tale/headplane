import { Key, useState } from "react";

import Dialog, { DialogPanel } from "~/components/Dialog";
import Select from "~/components/Select";
import Text from "~/components/Text";
import Title from "~/components/Title";
import type { Machine, User } from "~/types";
import { getUserDisplayName } from "~/utils/user";

interface MoveProps {
  machine: Machine;
  users: User[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Move({ machine, users, isOpen, setIsOpen }: MoveProps) {
  const [userId, setUserId] = useState<Key | null>(machine.user?.id ?? null);

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel isDisabled={userId === machine.user?.id}>
        <Title>Change the owner of {machine.givenName}</Title>
        <Text>The owner of the machine is the user associated with it.</Text>
        <input name="action_id" type="hidden" value="reassign" />
        <input name="node_id" type="hidden" value={machine.id} />
        <input name="user_id" type="hidden" value={userId?.toString()} />
        <Select
          defaultSelectedKey={machine.user?.id}
          isRequired
          label="Owner"
          name="user"
          onSelectionChange={(key) => {
            setUserId(key);
          }}
          placeholder="Select a user"
        >
          {users.map((user) => (
            <Select.Item key={user.id}>{getUserDisplayName(user)}</Select.Item>
          ))}
        </Select>
      </DialogPanel>
    </Dialog>
  );
}
