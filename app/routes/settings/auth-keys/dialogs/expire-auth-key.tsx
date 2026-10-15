import ActionDialog from "~/components/action-dialog";
import { RemoveButton } from "~/components/section";
import type { PreAuthKey, User } from "~/types";

interface ExpireAuthKeyProps {
  authKey: PreAuthKey;
  user: User;
}

export default function ExpireAuthKey({ authKey, user }: ExpireAuthKeyProps) {
  return (
    <ActionDialog
      description="The key stops working for new devices right away."
      fields={{ key_id: authKey.id, key: authKey.key, user_id: user.id }}
      intent="expire"
      isDestructive
      submitLabel="Expire key"
      title="Expire this auth key?"
      trigger={<RemoveButton>Expire</RemoveButton>}
    />
  );
}
