import Chip from "../chip";
import Tooltip from "../tooltip";

export interface SubnetTagProps {
  isEnabled?: boolean;
  count: number;
}

export function SubnetTag({ isEnabled, count }: SubnetTagProps) {
  return (
    <Tooltip
      content={
        isEnabled ? (
          <>This machine advertises subnet routes.</>
        ) : (
          <>
            This machine has subnet routes waiting for approval. Review them from "Edit route
            settings" in the machine's menu.
          </>
        )
      }
    >
      <Chip
        text={`${count} ${count === 1 ? "subnet" : "subnets"}`}
        variant={isEnabled ? "neutral" : "warn"}
      />
    </Tooltip>
  );
}
