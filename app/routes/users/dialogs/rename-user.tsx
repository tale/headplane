import ActionDialog from "~/components/action-dialog";
import Input from "~/components/input";
import type { User } from "~/types";
import { fieldValidator } from "~/utils/form";
import { USERNAME_RULE } from "~/utils/user";

import { username } from "../schemas";

interface RenameProps {
  user: User;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const validateUsername = fieldValidator(username);

export default function RenameUser({ user, isOpen, setIsOpen }: RenameProps) {
  return (
    <ActionDialog
      description="ACL policies that refer to the old username aren't updated."
      fields={{ headscale_user_id: user.id }}
      intent="rename"
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Rename"
      title={`Rename ${user.name || user.displayName}`}
    >
      <Input
        defaultValue={user.name}
        description={USERNAME_RULE}
        label="Username"
        name="name"
        required
        validate={validateUsername}
      />
    </ActionDialog>
  );
}
