import { Form } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Select from "~/components/select";

interface LinkAccountProps {
  headscaleUsers: { id: string; name: string }[];
}

export default function LinkAccount({ headscaleUsers }: LinkAccountProps) {
  return (
    <div className="mx-auto mt-6 flex max-w-xl flex-col items-center justify-center py-36">
      <Card className="max-w-xl items-center gap-4">
        <Card.Title>Link your Headscale account</Card.Title>
        <Card.Text>
          Headplane could not automatically match your SSO identity to an existing Headscale user.
          Please select your user from the list below to link your account and continue.
        </Card.Text>
        <Form method="POST" className="mt-4">
          <Select
            className="mb-4"
            items={headscaleUsers.map((u) => ({ value: u.id, label: u.name }))}
            label="Headscale user"
            name="headscale_user_id"
            placeholder="Select a user"
            required
          />
          <Button className="w-full" type="submit" variant="primary">
            Link and Continue
          </Button>
        </Form>
        <Card.Text className="text-muted mt-8 text-center text-xs">
          If you don't see your user listed, please contact your administrator. To automatically
          link new users in the future, ensure that the Headscale user has the same email address as
          the SSO identity.
        </Card.Text>
      </Card>
    </div>
  );
}
