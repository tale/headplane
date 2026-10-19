import Chip from "~/components/chip";
import { TableCell } from "~/components/table";
import type { PreAuthKey, User } from "~/types";
import { formatTimeDelta, formatTimeUntil } from "~/utils/time";
import { getUserDisplayName } from "~/utils/user";

import ExpireAuthKey from "./dialogs/expire-auth-key";

interface Props {
  authKey: PreAuthKey;
  user: User | null;
}

export default function AuthKeyRow({ authKey, user }: Props) {
  const createdAt = new Date(authKey.createdAt);
  const expiration = new Date(authKey.expiration);
  const isPastExpiry = expiration < new Date();
  const isSpent = authKey.used && !authKey.reusable;

  return (
    <tr>
      <TableCell>
        <div className="font-mono text-xs break-all">{authKey.key}</div>
        <div className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {authKey.aclTags.map((tag) => (
            <span className="font-mono" key={tag}>
              {tag}
            </span>
          ))}
          <Chip text={authKey.reusable ? "Reusable" : isSpent ? "Used" : "Single use"} />
          {authKey.ephemeral && <Chip text="Ephemeral" />}
        </div>
      </TableCell>
      <TableCell>
        {user ? getUserDisplayName(user) : <span className="text-muted">Tags only</span>}
      </TableCell>
      <TableCell
        className={isPastExpiry ? "text-muted whitespace-nowrap" : "whitespace-nowrap"}
        suppressHydrationWarning
        title={expiration.toLocaleString()}
      >
        {isPastExpiry ? `Expired ${formatTimeDelta(expiration)}` : formatTimeUntil(expiration)}
      </TableCell>
      <TableCell
        className="text-muted whitespace-nowrap"
        suppressHydrationWarning
        title={createdAt.toLocaleString()}
      >
        {formatTimeDelta(createdAt)}
      </TableCell>
      <TableCell className="py-1.5 text-right align-middle">
        {!isPastExpiry && !isSpent && user && <ExpireAuthKey authKey={authKey} user={user} />}
      </TableCell>
    </tr>
  );
}
