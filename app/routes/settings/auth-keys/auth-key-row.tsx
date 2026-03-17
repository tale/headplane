import Attribute from "~/components/attribute";
import type { PreAuthKey, User } from "~/types";
import { getUserDisplayName } from "~/utils/user";

import ExpireAuthKey from "./dialogs/expire-auth-key";

interface Props {
  authKey: PreAuthKey;
  user: User | null;
}

export default function AuthKeyRow({ authKey, user }: Props) {
  const createdAt = new Date(authKey.createdAt).toLocaleString();
  const expiration = new Date(authKey.expiration).toLocaleString();
  const isExpired =
    (authKey.used && !authKey.reusable) || new Date(authKey.expiration) < new Date();
  const userDisplay = user ? getUserDisplayName(user) : "(Tag Only)";

  return (
    <div className="w-full">
      <Attribute name="Key" value={authKey.key} />
      <Attribute name="User" value={userDisplay} />
      <Attribute name="Reusable" value={authKey.reusable ? "Yes" : "No"} />
      <Attribute name="Ephemeral" value={authKey.ephemeral ? "Yes" : "No"} />
      <Attribute name="Used" value={authKey.used ? "Yes" : "No"} />
      <Attribute name="Created" value={createdAt} />
      <Attribute name="Expiration" value={expiration} />
      {!isExpired && user && (
        <div className="mt-2" suppressHydrationWarning>
          <ExpireAuthKey authKey={authKey} user={user} />
        </div>
      )}
    </div>
  );
}
