import { formatTimeUntil } from "~/utils/time";

import Chip from "../chip";
import Tooltip from "../tooltip";

export interface ExpiryTagProps {
  variant: "expired" | "expiring" | "no-expiry";
  expiry?: string;
}

const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function ExpiryTag({ variant, expiry }: ExpiryTagProps) {
  const date = expiry ? formatter.format(new Date(expiry)) : undefined;

  switch (variant) {
    case "expired":
      return (
        <Tooltip
          content={`This machine's key expired on ${date}. Re-authenticate with Tailscale on the machine to reconnect it.`}
        >
          <Chip text="Expired" variant="bad" />
        </Tooltip>
      );

    case "expiring":
      return (
        <Tooltip
          content={`This machine's key expires on ${date}. Re-authenticate with Tailscale on the machine before then to stay connected.`}
        >
          <Chip text={`Key expires ${formatTimeUntil(new Date(expiry!))}`} variant="warn" />
        </Tooltip>
      );

    case "no-expiry":
      return (
        <Tooltip content="This machine has key expiry disabled and never needs to re-authenticate.">
          <Chip text="No expiry" />
        </Tooltip>
      );
  }
}
