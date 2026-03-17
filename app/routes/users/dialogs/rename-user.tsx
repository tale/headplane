import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";
import { User } from "~/types";

interface RenameProps {
  user: User;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// TODO: Server side validation before submitting
export default function RenameUser({ user, isOpen, setIsOpen }: RenameProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel>
        <Title>Rename {user.name || user.displayName}?</Title>
        <Text className="mb-6">
          Enter a new username for {user.name || user.displayName}. Changing a username will not
          update any ACL policies that may refer to this user by their old username.
        </Text>
        <input name="action_id" type="hidden" value="rename_user" />
        <input name="user_id" type="hidden" value={user.id} />
        <Input
          defaultValue={user.name}
          required
          label="Username"
          name="new_name"
          placeholder="my-new-name"
        />
      </DialogPanel>
    </Dialog>
  );
}
