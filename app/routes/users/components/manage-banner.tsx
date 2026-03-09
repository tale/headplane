import { Building2, House, Key } from "lucide-react";

import Card from "~/components/Card";
import Link from "~/components/link";

import CreateUser from "../dialogs/create-user";

interface ManageBannerProps {
  oidc?: { issuer: string };
  isDisabled?: boolean;
}

export default function ManageBanner({ oidc, isDisabled }: ManageBannerProps) {
  return (
    <Card className="mb-8 w-full max-w-full p-0" variant="flat">
      <div className="flex flex-col md:flex-row">
        <div className="w-full border-b border-mist-100 p-4 md:border-b-0 dark:border-mist-800">
          {oidc ? <Building2 className="mb-2 h-5 w-5" /> : <House className="mb-2 h-5 w-5" />}
          <h2 className="mb-1 font-medium">{oidc ? "OpenID Connect" : "User Authentication"}</h2>
          <p className="text-sm text-mist-600 dark:text-mist-300">
            {oidc ? (
              <>
                Users are managed through your{" "}
                <Link isExternal name="OIDC Provider" to={oidc.issuer}>
                  OpenID Connect provider
                </Link>
                {". "}
                Groups and user information do not automatically sync.{" "}
                <Link
                  name="Headscale OIDC Documentation"
                  to="https://headscale.net/stable/ref/oidc"
                >
                  Learn more
                </Link>
              </>
            ) : (
              <>
                Users are not managed externally. Using OpenID Connect can create a better
                experience when using Headscale.{" "}
                <Link
                  name="Headscale OIDC Documentation"
                  to="https://headscale.net/stable/ref/oidc"
                >
                  Learn more
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="w-full border-mist-100 p-4 md:border-l dark:border-mist-800">
          <Key className="mb-2 h-5 w-5" />
          <h2 className="mb-1 font-medium">User Management</h2>
          <p className="text-sm text-mist-600 dark:text-mist-300">
            {oidc
              ? "You can still add users manually, however it is recommended that you manage users through your OIDC provider."
              : "You can add, remove, and rename users here."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <CreateUser isDisabled={isDisabled} isOidc={oidc !== undefined} />
          </div>
        </div>
      </div>
    </Card>
  );
}
