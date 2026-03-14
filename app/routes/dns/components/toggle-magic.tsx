import Button from "~/components/Button";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Text from "~/components/Text";
import Title from "~/components/Title";

interface Props {
  isEnabled: boolean;
  isDisabled: boolean;
}

export default function Modal({ isEnabled, isDisabled }: Props) {
  return (
    <Dialog>
      <Button isDisabled={isDisabled}>{isEnabled ? "Disable" : "Enable"} Magic DNS</Button>
      <DialogPanel isDisabled={isDisabled}>
        <Title>{isEnabled ? "Disable" : "Enable"} Magic DNS</Title>
        <Text>
          Devices will no longer be accessible via your tailnet domain. The search domain will also
          be disabled.
        </Text>
        <input type="hidden" name="action_id" value="toggle_magic" />
        <input type="hidden" name="new_state" value={isEnabled ? "disabled" : "enabled"} />
      </DialogPanel>
    </Dialog>
  );
}
