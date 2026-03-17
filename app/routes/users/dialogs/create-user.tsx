import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";

interface CreateUserProps {
  isOidc?: boolean;
  isDisabled?: boolean;
}

export default function CreateUser({ isOidc, isDisabled }: CreateUserProps) {
  return (
    <Dialog>
      <Button disabled={isDisabled}>Add user</Button>
      <DialogPanel>
        <Title>Create a Headscale user</Title>
        <Text className="mb-6">
          This creates a new user in Headscale. The user will appear in the &ldquo;Unlinked
          Headscale Users&rdquo; section until they sign in
          {isOidc ? " through your OIDC provider" : ""} and are automatically linked to a Headplane
          account.
        </Text>
        <input name="action_id" type="hidden" value="create_user" />
        <div className="flex flex-col gap-4">
          <Input required label="Username" name="username" placeholder="my-new-user" type="text" />
          <Input label="Display Name" name="display_name" placeholder="John Doe" type="text" />
          <Input label="Email" name="email" placeholder="name@example.com" type="email" />
        </div>
      </DialogPanel>
    </Dialog>
  );
}
