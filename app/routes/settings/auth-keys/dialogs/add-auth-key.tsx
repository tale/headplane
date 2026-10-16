import { Plus } from "lucide-react";
import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Callout from "~/components/callout";
import CodeBlock from "~/components/code-block";
import { DialogDescription, DialogTitle } from "~/components/dialog";
import Link from "~/components/link";
import NumberInput from "~/components/number-input";
import Select from "~/components/select";
import { SwitchField } from "~/components/switch";
import TokenList from "~/components/token-list";
import type { User } from "~/types";
import { getUserDisplayName, sortUsersByDisplayName } from "~/utils/user";

interface AddAuthKeyProps {
  users: User[];
  url: string;
  selfServiceOnly: boolean;
  currentHeadscaleUserId?: string;
  currentSubject?: string;
}

function findCurrentUser(
  users: User[],
  headscaleUserId: string | undefined,
  subject: string | undefined,
): User | undefined {
  if (headscaleUserId) {
    const linked = users.find((u) => u.id === headscaleUserId);
    if (linked) {
      return linked;
    }
  }

  if (!subject) {
    return undefined;
  }
  return users.find((u) => {
    if (u.provider !== "oidc" || !u.providerId) {
      return false;
    }
    const segment = u.providerId.split("/").pop();
    return segment ? decodeURIComponent(segment) === subject : false;
  });
}

export default function AddAuthKey({
  users,
  url,
  selfServiceOnly,
  currentHeadscaleUserId,
  currentSubject,
}: AddAuthKeyProps) {
  const currentUser = selfServiceOnly
    ? findCurrentUser(users, currentHeadscaleUserId, currentSubject)
    : undefined;

  return (
    <ActionDialog
      description="Devices sign in with the key instead of an interactive login."
      intent="create"
      isDisabled={selfServiceOnly && !currentUser}
      submitLabel="Create key"
      success={({ key }) => (
        <>
          <DialogTitle>Auth key created</DialogTitle>
          <DialogDescription>Copy the key now. It won&apos;t be shown again.</DialogDescription>
          <CodeBlock>{key}</CodeBlock>
          <p className="text-muted">Register a device with it:</p>
          <CodeBlock>{`tailscale up --login-server=${url} --authkey ${key}`}</CodeBlock>
        </>
      )}
      title="Create auth key"
      trigger={
        <Button variant="primary">
          <Plus className="size-3.5" />
          Create key
        </Button>
      }
    >
      <AuthKeyFields currentUser={currentUser} selfServiceOnly={selfServiceOnly} users={users} />
    </ActionDialog>
  );
}

interface AuthKeyFieldsProps {
  users: User[];
  selfServiceOnly: boolean;
  currentUser?: User;
}

// Kept separate so its state resets each time the dialog opens.
function AuthKeyFields({ users, selfServiceOnly, currentUser }: AuthKeyFieldsProps) {
  const [isTagOnly, setIsTagOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  if (selfServiceOnly && !currentUser) {
    return (
      <Callout variant="warning">
        Your account isn&apos;t linked to a Headscale user yet, so you can&apos;t create a key.
      </Callout>
    );
  }

  return (
    <>
      {!selfServiceOnly && (
        <SwitchField
          checked={isTagOnly}
          description="The key belongs to its tags instead of a user."
          label="Tag-only key"
          onCheckedChange={setIsTagOnly}
        />
      )}
      {!isTagOnly &&
        (currentUser ? (
          <>
            <input name="user_id" type="hidden" value={currentUser.id} />
            <Select
              description="You can only create keys for your own user."
              disabled
              items={[{ value: currentUser.id, label: getUserDisplayName(currentUser) }]}
              label="User"
              value={currentUser.id}
            />
          </>
        ) : (
          <Select
            defaultValue={sortUsersByDisplayName(users)[0]?.id ?? null}
            description="Devices that sign in with the key belong to this user."
            items={sortUsersByDisplayName(users).map((user) => ({
              value: user.id,
              label: getUserDisplayName(user),
            }))}
            label="User"
            name="user_id"
            placeholder="Select a user"
            required
          />
        ))}
      {tags.map((tag) => (
        <input key={tag} name="tags" type="hidden" value={tag} />
      ))}
      <TokenList
        emptyText={isTagOnly ? "Add at least one tag" : "No tags"}
        label="Tags"
        normalize={(value) => (value.startsWith("tag:") ? value : `tag:${value}`)}
        onChange={setTags}
        placeholder="tag:server"
        validate={(value) => /^tag:\S+$/.test(value)}
        values={tags}
      />
      <NumberInput
        defaultValue={90}
        label="Expires after (days)"
        max={365_000}
        min={1}
        name="expiry"
        required
      />
      <SwitchField
        description="The key can sign in more than one device."
        label="Reusable"
        name="reusable"
      />
      <SwitchField
        description={
          <>
            Devices are removed once they go offline.{" "}
            <Link external styled to="https://tailscale.com/kb/1111/ephemeral-nodes">
              Docs
            </Link>
          </>
        }
        label="Ephemeral"
        name="ephemeral"
      />
    </>
  );
}
