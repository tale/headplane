import { Form } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import cn from "~/utils/cn";

interface LinkAccountProps {
  headscaleUsers: { id: string; name: string }[];
}

export default function LinkAccount({ headscaleUsers }: LinkAccountProps) {
  return (
    <div className="mx-auto mt-6 flex max-w-xl flex-col items-center justify-center py-36">
      <Card variant="flat" className="max-w-xl items-center gap-4">
        <Card.Title>Link your Headscale account</Card.Title>
        <Card.Text>
          Headplane could not automatically match your SSO identity to an existing Headscale user.
          Please select your user from the list below to link your account and continue.
        </Card.Text>
        <Form method="POST" className="mt-4">
          <select
            className={cn(
              "mb-4 w-full rounded-lg border p-2",
              "border-mist-200 dark:border-mist-700",
              "bg-mist-50 dark:bg-mist-900",
            )}
            name="headscale_user_id"
            required
          >
            <option value="">Select a user...</option>
            {headscaleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <Button className="w-full" type="submit" variant="heavy">
            Link and Continue
          </Button>
        </Form>
        <Card.Text className="mt-8 text-center text-xs text-mist-600 dark:text-mist-300">
          If you don't see your user listed, please contact your administrator. To automatically
          link new users in the future, ensure that the Headscale user has the same email address as
          the SSO identity.
        </Card.Text>
      </Card>
    </div>
  );
}
