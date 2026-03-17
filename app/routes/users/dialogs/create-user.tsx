import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Input from "~/components/Input";
import Text from "~/components/Text";
import Title from "~/components/Title";

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
          <Input
            isRequired
            label="Username"
            name="username"
            placeholder="my-new-user"
            type="text"
            validate={(value) => {
              if (value.trim().length === 0) {
                return "Username is required";
              }

              if (value.includes(" ")) {
                return "Usernames cannot contain spaces";
              }

              return true;
            }}
            validationBehavior="native"
          />
          <Input
            label="Display Name"
            name="display_name"
            placeholder="John Doe"
            type="text"
            validationBehavior="native"
          />
          <Input
            label="Email"
            name="email"
            placeholder="name@example.com"
            type="email"
            validationBehavior="native"
          />
        </div>
      </DialogPanel>
    </Dialog>
  );
}
