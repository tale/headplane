import cn from "~/utils/cn";

import Chip from "../chip";
import Tooltip from "../tooltip";

export function TailscaleSSHTag() {
  return (
    <Tooltip content="This machine advertises Tailscale SSH, which allows you to authenticate SSH credentials using your Tailscale account and via the Headplane web UI.">
      <Chip text="Tailscale SSH" className={cn("bg-ok-subtle text-ok")} />
    </Tooltip>
  );
}
