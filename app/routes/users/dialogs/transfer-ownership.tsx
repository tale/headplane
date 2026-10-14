import ActionDialog from "~/components/action-dialog";

interface TransferOwnershipProps {
  targetHeadplaneUserId: string;
  targetDisplayName: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function TransferOwnership({
  targetHeadplaneUserId,
  targetDisplayName,
  isOpen,
  setIsOpen,
}: TransferOwnershipProps) {
  return (
    <ActionDialog
      description={`${targetDisplayName} becomes the owner of this Headplane instance and you become an Admin. Only the new owner can transfer it back.`}
      fields={{ headplane_user_id: targetHeadplaneUserId }}
      intent="transfer"
      isDestructive
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Transfer ownership"
      title={`Transfer ownership to ${targetDisplayName}?`}
    />
  );
}
