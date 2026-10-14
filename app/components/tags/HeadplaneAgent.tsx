import Chip from "../chip";
import Tooltip from "../tooltip";

export function HeadplaneAgentTag() {
  return (
    <Tooltip content="This machine is running the Headplane agent, which allows it to provide host information in the web UI.">
      <Chip text="Agent" />
    </Tooltip>
  );
}
