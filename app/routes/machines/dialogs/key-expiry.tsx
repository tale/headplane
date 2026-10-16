import ActionDialog from "~/components/action-dialog";
import type { Machine } from "~/types";
import { isNoExpiry } from "~/utils/node-info";

interface KeyExpiryProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function KeyExpiry({ machine, isOpen, setIsOpen }: KeyExpiryProps) {
  const isDisabling = !isNoExpiry(machine.expiry);

  return (
    <ActionDialog
      description={
        isDisabling
          ? "The machine stays signed in until you expire or remove it."
          : "The machine has to sign in again when its key expires."
      }
      fields={{ node_id: machine.id, disable_expiry: String(isDisabling) }}
      intent="toggle_expiry"
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel={isDisabling ? "Disable key expiry" : "Enable key expiry"}
      title={`${isDisabling ? "Disable" : "Enable"} key expiry for ${machine.givenName}?`}
    />
  );
}
