import { Info } from "lucide-react";

import cn from "~/utils/cn";

import Chip from "../chip";
import Tooltip from "../tooltip";

export interface ExitNodeTagProps {
  isEnabled?: boolean;
}

export function ExitNodeTag({ isEnabled }: ExitNodeTagProps) {
  return (
    <Tooltip
      content={
        isEnabled ? (
          <>This machine is acting as an exit node.</>
        ) : (
          <>
            This machine is requesting to be used as an exit node. Review this from the "Edit route
            settings..." option in the machine's menu.
          </>
        )
      }
    >
      <Chip
        text="Exit Node"
        className={cn("bg-accent-subtle text-accent")}
        rightIcon={isEnabled ? undefined : <Info className="h-full w-fit" />}
      />
    </Tooltip>
  );
}
