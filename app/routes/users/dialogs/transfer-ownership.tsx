import Dialog, { DialogPanel } from "~/components/Dialog";
import Notice from "~/components/Notice";
import Text from "~/components/Text";
import Title from "~/components/Title";

interface TransferOwnershipProps {
  targetUserId: string;
  targetDisplayName: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function TransferOwnership({
  targetUserId,
  targetDisplayName,
  isOpen,
  setIsOpen,
}: TransferOwnershipProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant="destructive">
        <Title>Transfer ownership to {targetDisplayName}?</Title>
        <Text className="mb-6">
          This will make {targetDisplayName} the new owner of this Headplane instance. You will be
          demoted to an Admin. This action cannot be easily undone.
        </Text>
        <Notice variant="warning">
          Only the owner can transfer ownership. After this, you will no longer be able to manage
          ownership.
        </Notice>
        <input name="action_id" type="hidden" value="transfer_ownership" />
        <input name="user_id" type="hidden" value={targetUserId} />
      </DialogPanel>
    </Dialog>
  );
}
