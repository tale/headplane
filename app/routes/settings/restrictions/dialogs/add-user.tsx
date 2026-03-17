import { useMemo, useState } from "react";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Text from "~/components/Text";
import Title from "~/components/Title";

interface AddUserProps {
  users: string[];
  isDisabled?: boolean;
}

export default function AddUser({ users, isDisabled }: AddUserProps) {
  const [user, setUser] = useState("");

  const isInvalid = useMemo(() => {
    if (!user || user.trim().length === 0) {
      // Empty user is invalid, but no error shown
      return false;
    }

    if (users.includes(user.trim())) {
      return true;
    }
  }, [user, users]);

  return (
    <Dialog>
      <Button disabled={isDisabled}>Add user</Button>
      <DialogPanel>
        <Title>Add user</Title>
        <Text className="mb-4">
          Add this user to a list of allowed users that can authenticate with Headscale via OIDC.
        </Text>
        <input name="action_id" type="hidden" value="add_user" />
        <Input
          description="The user to allow for OIDC authentication."
          isInvalid={user.trim().length === 0 || isInvalid}
          isRequired
          label="User"
          name="user"
          onChange={setUser}
          placeholder="john_doe"
        />
        {isInvalid && (
          <p className="mt-2 text-sm text-red-500">
            The user you entered already exists in the list of allowed users.
          </p>
        )}
      </DialogPanel>
    </Dialog>
  );
}
