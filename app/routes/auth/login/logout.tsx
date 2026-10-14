import { Link as RouterLink } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";

export default function Logout() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card className="m-4 max-w-md sm:m-0">
        <h2 className="mb-2 text-lg font-semibold">You have been logged out</h2>
        <p>You can now close this window.</p>
        <RouterLink to="/login" prefetch="none" reloadDocument>
          <Button className="mt-8 w-full" variant="primary">
            Sign in again
          </Button>
        </RouterLink>
      </Card>
    </div>
  );
}
