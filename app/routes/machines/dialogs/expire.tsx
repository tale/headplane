import ActionDialog from "~/components/action-dialog";
import type { Machine } from "~/types";

interface ExpireProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Expire({ machine, isOpen, setIsOpen }: ExpireProps) {
  return (
    <ActionDialog
      description="The machine disconnects from your tailnet until someone signs in on it again."
      fields={{ node_id: machine.id }}
      intent="expire"
      isDestructive
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Expire"
      title={`Expire ${machine.givenName}?`}
    />
  );
}
