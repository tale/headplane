import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Input from "~/components/input";

interface Props {
  name: string;
  isDisabled: boolean;
}

export default function RenameTailnet({ name, isDisabled }: Props) {
  return (
    <ActionDialog
      description="Devices may misbehave until they pick up the new name."
      intent="rename_tailnet"
      submitLabel="Rename"
      title="Rename tailnet"
      trigger={
        <Button disabled={isDisabled} size="sm">
          Rename
        </Button>
      }
    >
      <Input defaultValue={name} label="Tailnet name" name="name" placeholder="ts.net" required />
    </ActionDialog>
  );
}
