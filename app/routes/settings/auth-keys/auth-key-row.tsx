import type { PreAuthKey, User } from "~/types";

import Attribute from "~/components/Attribute";

import ExpireAuthKey from "./dialogs/expire-auth-key";

interface Props {
  authKey: PreAuthKey;
  user: User;
}

export default function AuthKeyRow({ authKey, user }: Props) {
  const createdAt = new Date(authKey.createdAt).toLocaleString();
  const expiration = new Date(authKey.expiration).toLocaleString();

  return (
    <div className="w-full">
      <Attribute name="Key" value={authKey.key} />
      <Attribute name="User" value={user.name || user.displayName || user.email || user.id} />
      <Attribute name="Reusable" value={authKey.reusable ? "Yes" : "No"} />
      <Attribute name="Ephemeral" value={authKey.ephemeral ? "Yes" : "No"} />
      <Attribute name="Used" value={authKey.used ? "Yes" : "No"} />
      <Attribute name="Created" value={createdAt} />
      <Attribute name="Expiration" value={expiration} />
      {!((authKey.used && !authKey.reusable) || new Date(authKey.expiration) < new Date()) && (
        <div className="mt-2" suppressHydrationWarning>
          <ExpireAuthKey authKey={authKey} user={user} />
        </div>
      )}
    </div>
  );
}
