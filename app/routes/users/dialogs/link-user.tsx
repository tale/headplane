import Callout from "~/components/callout";
import Dialog, { DialogPanel } from "~/components/legacy-dialog";
import Select from "~/components/select";
import Text from "~/components/text";
import Title from "~/components/title";

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
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel>
        <Title>Link Headscale user for {displayName}</Title>
        <Text className="mb-6">
          Select which Headscale user this identity should be linked to. This controls which
          machines they can manage and enables self-service features.
        </Text>
        {headscaleUsers.length === 0 ? (
          <Callout>All Headscale users are already linked to other accounts.</Callout>
        ) : (
          <>
            <input name="action_id" type="hidden" value="link_user" />
            <input name="headplane_user_id" type="hidden" value={headplaneUserId} />
            <Select
              defaultValue={currentLink ?? null}
              items={headscaleUsers.map((u) => ({
                value: u.id,
                label: u.id === currentLink ? `${u.name} (current)` : u.name,
              }))}
              label="Headscale user"
              name="headscale_user_id"
              placeholder="Select a Headscale user"
              required
            />
          </>
        )}
      </DialogPanel>
    </Dialog>
  );
}
