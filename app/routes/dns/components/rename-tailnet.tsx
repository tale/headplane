import Button from "~/components/button";
import Code from "~/components/code";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Text from "~/components/text";
import Title from "~/components/title";

interface Props {
  name: string;
  isDisabled: boolean;
}

export default function RenameTailnet({ name, isDisabled }: Props) {
  return (
    <div className="flex w-full flex-col gap-y-4 sm:w-2/3">
      <h1 className="mb-2 text-2xl font-medium">Tailnet Name</h1>
      <p>
        This is the base domain name of your Tailnet. Devices are accessible at{" "}
        <Code>[device].{name}</Code> when Magic DNS is enabled.
      </p>
      <Input
        className="w-3/5 text-sm font-medium"
        readOnly
        label="Tailnet name"
        labelHidden
        onFocus={(event) => {
          (event.target as HTMLInputElement).select();
        }}
        value={name}
      />
      <Dialog>
        <Button disabled={isDisabled}>Rename Tailnet</Button>
        <DialogPanel isDisabled={isDisabled}>
          <Title>Rename Tailnet</Title>
          <Text className="mb-8">
            Keep in mind that changing this can lead to all sorts of unexpected behavior and may
            break existing devices in your tailnet.
          </Text>
          <input name="action_id" type="hidden" value="rename_tailnet" />
          <Input
            defaultValue={name}
            required
            label="Tailnet name"
            name="new_name"
            placeholder="ts.net"
          />
        </DialogPanel>
      </Dialog>
    </div>
  );
}
