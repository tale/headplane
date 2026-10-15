import { Plus } from "lucide-react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";
import { fieldValidator } from "~/utils/form";
import { USERNAME_RULE } from "~/utils/user";

import { username } from "../schemas";

interface CreateUserProps {
  isOidc?: boolean;
  isDisabled?: boolean;
}

const validateUsername = fieldValidator(username);

export default function CreateUser({ isOidc, isDisabled }: CreateUserProps) {
  return (
    <ActionDialog
      description={`The user is listed under Unlinked Headscale Users until they sign in${
        isOidc ? " through your OIDC provider" : ""
      }, which links them to a Headplane account.`}
      intent="create"
      submitLabel="Create user"
      title="Create a Headscale user"
      trigger={
        <Button disabled={isDisabled} variant="primary">
          <Plus className="size-3.5" />
          Add user
        </Button>
      }
    >
      <Input
        description={USERNAME_RULE}
        label="Username"
        name="name"
        placeholder="my-new-user"
        required
        validate={validateUsername}
      />
      <Input label="Display name" name="display_name" placeholder="John Doe" />
      <Input label="Email" name="email" placeholder="name@example.com" type="email" />
    </ActionDialog>
  );
}
