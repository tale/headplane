import Button from "~/components/Button";
import Dialog, { DialogPanel } from "~/components/Dialog";
import Text from "~/components/Text";
import Title from "~/components/Title";
import type { PreAuthKey, User } from "~/types";

interface ExpireAuthKeyProps {
  authKey: PreAuthKey;
  user: User;
}

export default function ExpireAuthKey({ authKey, user }: ExpireAuthKeyProps) {
  return (
    <Dialog>
      <Button variant="heavy">Expire Key</Button>
      <DialogPanel variant="destructive">
        <Title>Expire auth key?</Title>
        <input name="action_id" type="hidden" value="expire_preauthkey" />
        <input name="user_id" type="hidden" value={user.id} />
        <input name="key" type="hidden" value={authKey.key} />
        <Text>
          Expiring this authentication key will immediately prevent it from being used to
          authenticate new devices. This action cannot be undone.
        </Text>
      </DialogPanel>
    </Dialog>
  );
}
