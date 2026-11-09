import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import type { Machine, User } from "~/types";

interface DeleteProps {
  user: User;
  machines: Machine[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function DeleteUser({ user, machines, isOpen, setIsOpen }: DeleteProps) {
  const hasMachines = machines.length > 0;

  return (
    <ActionDialog
      description={
        user.provider === "oidc"
          ? "Deleted users can't be recovered. Their Headplane account is deleted with them and signed out; since they sign in through your OIDC provider, signing in again recreates both."
          : "Deleted users can't be recovered. Their Headplane account is deleted with them and signed out."
      }
      fields={{ headscale_user_id: user.id }}
      intent="delete"
      isDestructive
      isDisabled={hasMachines}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Delete"
      title={`Delete ${user.name || user.displayName}?`}
    >
      {hasMachines && (
        <Callout variant="warning">
          This user still owns machines. Remove them or change their owner first.
        </Callout>
      )}
    </ActionDialog>
  );
}
