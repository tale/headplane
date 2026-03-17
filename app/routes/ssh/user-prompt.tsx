import { useState } from "react";

import Button from "~/components/button";
import Card from "~/components/card";
import Code from "~/components/code";
import Input from "~/components/input";

interface UserPromptProps {
  hostname: string;
}

export default function UserPrompt({ hostname }: UserPromptProps) {
  const [username, setUsername] = useState("");

  return (
    <div className="flex h-screen items-center justify-center">
      <Card>
        <Card.Title>Enter Username</Card.Title>
        <Card.Text className="mb-4">
          Enter the username you want to use to connect to <Code>{hostname}</Code>
          {". "}
          WebSSH follows the Headscale ACLs, so only permitted usernames will be able to connect.
        </Card.Text>
        <Input
          labelHidden
          type="text"
          label="Username"
          placeholder="Username"
          className="mb-2"
          onChange={setUsername}
        />
        <Button
          variant="heavy"
          className="w-full"
          onClick={() => {
            // We can't use the navigate hook here as we need to do a
            // full page reload to ensure the SSH connection is established
            window.location.href = `${__PREFIX__}/ssh?hostname=${hostname}&username=${username}`;
          }}
        >
          Connect
        </Button>
      </Card>
    </div>
  );
}
