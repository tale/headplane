import { Form } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Code from "~/components/code";
import Input from "~/components/input";
import Link from "~/components/link";

interface UserPromptProps {
  hostname: string;
}

export default function UserPrompt({ hostname }: UserPromptProps) {
  return (
    <div className="flex h-screen items-center justify-center">
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Enter Username</h2>
        <p className="mb-4">
          Enter the username you want to use to connect to <Code>{hostname}</Code>
          {". "}
          SSH via the web follows the same ACL rules as regular SSH access in Headscale, so only
          permitted usernames will work.
          <br />
          <br />
          See the{" "}
          <Link external styled to="https://headplane.net/features/ssh#troubleshooting">
            troubleshooting guide
          </Link>{" "}
          for common errors.
        </p>
        <Form
          method="GET"
          onSubmit={(e) => {
            const formData = new FormData(e.currentTarget);
            const username = formData.get("user");
            if (!username) {
              e.preventDefault();
              return;
            }

            // We have to do a full navigation, since the page needs a full
            // reload to initialize the SSH connection due to us disabling the
            // revalidator.
            const url = new URL(window.location.href);
            url.searchParams.set("user", username.toString());
            window.location.assign(url.toString());
          }}
        >
          <Input
            labelHidden
            type="text"
            label="Username"
            name="user"
            placeholder="Username"
            className="mb-2"
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Connect
          </Button>
        </Form>
      </Card>
    </div>
  );
}
