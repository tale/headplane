import Dialog, { DialogPanel } from "~/components/Dialog";
import Text from "~/components/Text";
import Title from "~/components/Title";
import type { Machine } from "~/types";

interface ExpireProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Expire({ machine, isOpen, setIsOpen }: ExpireProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant="destructive">
        <Title>Expire {machine.givenName}</Title>
        <Text>
          This will disconnect the machine from your Tailnet. In order to reconnect, you will need
          to re-authenticate from the device.
        </Text>
        <input name="action_id" type="hidden" value="expire" />
        <input name="node_id" type="hidden" value={machine.id} />
      </DialogPanel>
    </Dialog>
  );
}
