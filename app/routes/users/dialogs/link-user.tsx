import Dialog, { DialogPanel } from "~/components/dialog";
import Notice from "~/components/notice";
import Text from "~/components/text";
import Title from "~/components/title";
import cn from "~/utils/cn";

interface LinkUserProps {
  userId: string;
  displayName: string;
  headscaleUsers: { id: string; name: string }[];
  currentLink?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function LinkUser({
  userId,
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
          <Notice>All Headscale users are already linked to other accounts.</Notice>
        ) : (
          <>
            <input name="action_id" type="hidden" value="link_user" />
            <input name="user_id" type="hidden" value={userId} />
            <select
              className={cn(
                "w-full rounded-lg border p-2",
                "border-mist-200 dark:border-mist-700",
                "bg-mist-50 dark:bg-mist-900",
              )}
              defaultValue={currentLink ?? ""}
              name="headscale_user_id"
              required
            >
              <option value="">Select a Headscale user...</option>
              {headscaleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === currentLink ? " (current)" : ""}
                </option>
              ))}
            </select>
          </>
        )}
      </DialogPanel>
    </Dialog>
  );
}
