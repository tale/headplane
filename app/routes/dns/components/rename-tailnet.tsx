import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Code from "~/components/code";
import Input from "~/components/input";

interface Props {
  name: string;
  isDisabled: boolean;
}

export default function RenameTailnet({ name, isDisabled }: Props) {
  return (
    <div className="flex w-full flex-col gap-y-4 sm:w-2/3">
      <h2 className="mb-2 text-lg font-semibold">Tailnet Name</h2>
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
      <ActionDialog
        description="Devices may misbehave until they pick up the new name."
        intent="rename_tailnet"
        submitLabel="Rename"
        title="Rename tailnet"
        trigger={
          <Button className="self-start" disabled={isDisabled}>
            Rename tailnet
          </Button>
        }
      >
        <Input defaultValue={name} label="Tailnet name" name="name" placeholder="ts.net" required />
      </ActionDialog>
    </div>
  );
}
