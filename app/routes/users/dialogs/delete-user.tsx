import Dialog, { DialogPanel } from "~/components/dialog";
import Text from "~/components/text";
import Title from "~/components/title";
import type { Machine, User } from "~/types";

interface DeleteProps {
  user: User;
  machines: Machine[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function DeleteUser({ user, machines, isOpen, setIsOpen }: DeleteProps) {
  const name = user.name || user.displayName;

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant={machines.length > 0 ? "unactionable" : "normal"}>
        <Title>Delete {name}?</Title>
        {machines.length > 0 ? (
          <Text className="mb-6">
            Users cannot be deleted if they have machines. Please delete or re-assign their machines
            to other users before proceeding.
          </Text>
        ) : (
          <Text className="mb-6">
            Deleted users cannot be recovered.
            {user.provider === "oidc" && (
              <p className="mt-4 text-sm text-mist-600 dark:text-mist-300">
                Since this user is authenticated via an external provider, they will be recreated if
                they sign in again.
              </p>
            )}
          </Text>
        )}
        <input name="action_id" type="hidden" value="delete_user" />
        <input name="user_id" type="hidden" value={user.id} />
      </DialogPanel>
    </Dialog>
  );
}
