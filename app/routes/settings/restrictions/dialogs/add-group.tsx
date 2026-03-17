import { useMemo, useState } from "react";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";

interface AddGroupProps {
  groups: string[];
  isDisabled?: boolean;
}

export default function AddGroup({ groups, isDisabled }: AddGroupProps) {
  const [group, setGroup] = useState("");

  const isInvalid = useMemo(() => {
    if (!group || group.trim().length === 0) {
      // Empty group is invalid, but no error shown
      return false;
    }

    if (groups.includes(group.trim())) {
      return true;
    }
  }, [group, groups]);

  return (
    <Dialog>
      <Button disabled={isDisabled}>Add group</Button>
      <DialogPanel>
        <Title>Add group</Title>
        <Text className="mb-4">
          Add this group to a list of allowed groups that can authenticate with Headscale via OIDC.
        </Text>
        <input name="action_id" type="hidden" value="add_group" />
        <Input
          description="The group to allow for OIDC authentication."
          invalid={group.trim().length === 0 || isInvalid}
          required
          label="Group"
          name="group"
          onChange={setGroup}
          placeholder="admin"
        />
        {isInvalid && (
          <p className="mt-2 text-sm text-red-500">
            The group you entered already exists in the list of allowed groups.
          </p>
        )}
      </DialogPanel>
    </Dialog>
  );
}
