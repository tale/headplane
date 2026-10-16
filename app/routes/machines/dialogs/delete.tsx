import ActionDialog from "~/components/action-dialog";
import type { Machine } from "~/types";

interface DeleteProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Delete({ machine, isOpen, setIsOpen }: DeleteProps) {
  return (
    <ActionDialog
      description="The machine is removed from your tailnet. To add it back, sign in to your tailnet from the device again."
      fields={{ node_id: machine.id }}
      intent="delete"
      isDestructive
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Remove"
      title={`Remove ${machine.givenName}?`}
    />
  );
}
