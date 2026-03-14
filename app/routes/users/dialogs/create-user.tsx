import Dialog from "~/components/Dialog";
import Input from "~/components/Input";

interface CreateUserProps {
  isOidc?: boolean;
  isDisabled?: boolean;
}

export default function CreateUser({ isOidc, isDisabled }: CreateUserProps) {
  return (
    <Dialog>
      <Dialog.Button isDisabled={isDisabled}>Add user</Dialog.Button>
      <Dialog.Panel>
        <Dialog.Title>Create a Headscale user</Dialog.Title>
        <Dialog.Text className="mb-6">
          This creates a new user in Headscale. The user will appear in the &ldquo;Unlinked
          Headscale Users&rdquo; section until they sign in
          {isOidc ? " through your OIDC provider" : ""} and are automatically linked to a Headplane
          account.
        </Dialog.Text>
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
      </Dialog.Panel>
    </Dialog>
  );
}
