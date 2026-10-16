import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import Select from "~/components/select";

interface LinkUserProps {
  headplaneUserId: string;
  displayName: string;
  headscaleUsers: { id: string; name: string }[];
  currentLink?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function LinkUser({
  headplaneUserId,
  displayName,
  headscaleUsers,
  currentLink,
  isOpen,
  setIsOpen,
}: LinkUserProps) {
  const hasChoices = headscaleUsers.length > 0;

  return (
    <ActionDialog
      description="The linked Headscale user decides which machines they can manage and enables self-service features."
      fields={{ headplane_user_id: headplaneUserId }}
      intent="link"
      isDisabled={!hasChoices}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Link user"
      title={`Link a Headscale user to ${displayName}`}
    >
      {hasChoices ? (
        <Select
          defaultValue={currentLink ?? null}
          items={headscaleUsers.map((user) => ({
            value: user.id,
            label: user.id === currentLink ? `${user.name} (current)` : user.name,
          }))}
          label="Headscale user"
          name="headscale_user_id"
          placeholder="Select a Headscale user"
          required
        />
      ) : (
        <Callout>Every Headscale user is already linked to another account.</Callout>
      )}
    </ActionDialog>
  );
}
