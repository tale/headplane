import Dialog from "~/components/Dialog";
import Notice from "~/components/Notice";
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
      <Dialog.Panel>
        <Dialog.Title>Link Headscale user for {displayName}</Dialog.Title>
        <Dialog.Text className="mb-6">
          Select which Headscale user this identity should be linked to. This controls which
          machines they can manage and enables self-service features.
        </Dialog.Text>
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
      </Dialog.Panel>
    </Dialog>
  );
}
