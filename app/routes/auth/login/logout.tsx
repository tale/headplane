import { Link as RouterLink } from "react-router";

import Button from "~/components/button";

import Shell from "./shell";

export default function Logout() {
  return (
    <Shell description="You can close this window." title="You're signed out">
      <Button
        className="w-full"
        nativeButton={false}
        render={<RouterLink prefetch="none" reloadDocument to="/login" />}
        variant="primary"
      >
        Sign in again
      </Button>
    </Shell>
  );
}
