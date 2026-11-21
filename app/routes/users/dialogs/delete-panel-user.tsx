import ActionDialog from "~/components/action-dialog";

interface DeletePanelUserProps {
  headplaneUserId: string;
  displayName: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function DeletePanelUser({
  headplaneUserId,
  displayName,
  isOpen,
  setIsOpen,
}: DeletePanelUserProps) {
  return (
    <ActionDialog
      description="This removes the Headplane user and signs it out. The account at the identity provider stays; it comes back here if it signs in again and is still allowed to."
      fields={{ headplane_user_id: headplaneUserId }}
      intent="delete_panel"
      isDestructive
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Delete"
      title={`Delete ${displayName}?`}
    />
  );
}
