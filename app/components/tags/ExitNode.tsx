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
            This machine is requesting to be used as an exit node. Review it from "Edit route
            settings" in the machine's menu.
          </>
        )
      }
    >
      <Chip text="Exit node" variant={isEnabled ? "neutral" : "warn"} />
    </Tooltip>
  );
}
