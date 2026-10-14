import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";

interface Props {
  isEnabled: boolean;
  isDisabled: boolean;
}

export default function ToggleMagic({ isEnabled, isDisabled }: Props) {
  const label = isEnabled ? "Disable Magic DNS" : "Enable Magic DNS";

  return (
    <ActionDialog
      description={
        isEnabled
          ? "Devices will no longer be reachable at your tailnet domain, and the search domain is removed."
          : "Devices become reachable at your tailnet domain, which is added as the first search domain."
      }
      fields={{ enabled: String(!isEnabled) }}
      intent="toggle_magic"
      submitLabel={label}
      title={`${label}?`}
      trigger={
        <Button className="self-start" disabled={isDisabled}>
          {label}
        </Button>
      }
    />
  );
}
