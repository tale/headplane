import { type } from "arktype";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";
import { useForm } from "~/hooks/use-form";

const userSchema = type({
  user: "string > 0",
});

interface AddUserProps {
  users: string[];
  isDisabled?: boolean;
}

export default function AddUser({ users, isDisabled }: AddUserProps) {
  const form = useForm({
    schema: userSchema,
    validate: (values) => {
      const user = (values.user as string).trim();
      if (user.length === 0) return undefined;

      if (users.includes(user)) {
        return { user: "This user already exists in the list." };
      }

      return undefined;
    },
  });

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
          {...form.field("user")}
          description="The user to allow for OIDC authentication."
          required
          label="User"
          placeholder="john_doe"
        />
      </DialogPanel>
    </Dialog>
  );
}
