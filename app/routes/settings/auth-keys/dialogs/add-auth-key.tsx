import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import CodeBlock from "~/components/code-block";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Link from "~/components/link";
import NumberInput from "~/components/number-input";
import Select from "~/components/select";
import Switch from "~/components/switch";
import Text from "~/components/text";
import Title from "~/components/title";
import type { User } from "~/types";
import { getUserDisplayName } from "~/utils/user";

interface AddAuthKeyProps {
  users: User[];
  url: string;
  selfServiceOnly: boolean;
  currentSubject?: string;
}

function findCurrentUser(users: User[], subject: string | undefined): User | undefined {
  if (!subject) {
    return undefined;
  }
  return users.find((u) => {
    if (u.provider !== "oidc" || !u.providerId) {
      return false;
    }
    return u.providerId.split("/").pop() === subject;
  });
}

export default function AddAuthKey({
  users,
  url,
  selfServiceOnly,
  currentSubject,
}: AddAuthKeyProps) {
  const fetcher = useFetcher();
  const submittingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [tagOnly, setTagOnly] = useState(false);
  const currentUser = selfServiceOnly ? findCurrentUser(users, currentSubject) : null;
  const availableUsers = selfServiceOnly && currentUser ? [currentUser] : users;
  const [userId, setUserId] = useState<string | null>(availableUsers[0]?.id);
  const [tags, setTags] = useState("");

  const createdKey = fetcher.data?.success ? fetcher.data.key : null;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      submittingRef.current = false;
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (!isOpen) {
      setReusable(false);
      setEphemeral(false);
      setTagOnly(false);
      setUserId(availableUsers[0]?.id);
      setTags("");
      fetcher.data = undefined;
    }
  }, [isOpen]);

  const parsedTags = tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith("tag:") ? t : `tag:${t}`));

  const canSubmit = tagOnly ? parsedTags.length > 0 : userId != null;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && submittingRef.current) {
          return;
        }
        setIsOpen(open);
      }}
    >
      <Button className="my-4" onClick={() => setIsOpen(true)}>
        Create pre-auth key
      </Button>
      {createdKey ? (
        <DialogPanel variant="unactionable">
          <Title>Pre-auth key created</Title>
          <Text>Copy this key now. You will not be able to see the full key again.</Text>
          <CodeBlock className="mt-4">{createdKey}</CodeBlock>
          <Text className="mt-4 text-sm">To register a device with this key:</Text>
          <CodeBlock className="mt-1">
            {`tailscale up --login-server=${url} --authkey ${createdKey}`}
          </CodeBlock>
        </DialogPanel>
      ) : (
        <DialogPanel
          onSubmit={(event) => {
            event.preventDefault();
            submittingRef.current = true;
            const form = new FormData(event.currentTarget as HTMLFormElement);
            form.set("action_id", "add_preauthkey");
            form.set("user_id", tagOnly ? "" : (userId?.toString() ?? ""));
            form.set("reusable", reusable ? "on" : "off");
            form.set("ephemeral", ephemeral ? "on" : "off");
            form.set("acl_tags", parsedTags.join(","));
            fetcher.submit(form, { method: "POST" });
          }}
          isDisabled={fetcher.state !== "idle" || !canSubmit}
        >
          <Title>Generate auth key</Title>

          {!selfServiceOnly && (
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <Text className="font-semibold">Tag-only key</Text>
                <Text className="text-sm">Create a key owned by ACL tags instead of a user.</Text>
              </div>
              <Switch
                defaultChecked={tagOnly}
                label="Tag-only"
                onCheckedChange={() => setTagOnly(!tagOnly)}
              />
            </div>
          )}

          {!tagOnly && (
            <Select
              className="mb-2"
              description={
                selfServiceOnly
                  ? "You can only create keys for your own user."
                  : "Machines will belong to this user when they authenticate."
              }
              disabled={selfServiceOnly}
              required
              label="User"
              onValueChange={(value) => setUserId(value)}
              placeholder="Select a user"
              value={userId}
              items={availableUsers.map((user) => ({
                value: user.id,
                label: getUserDisplayName(user),
              }))}
            />
          )}

          <Input
            className="mb-2"
            description="Comma-separated tags (e.g. server, prod). The tag: prefix is added automatically."
            required={tagOnly}
            label="ACL Tags"
            onChange={(value) => setTags(value)}
            placeholder="server, prod"
            value={tags}
          />
          <NumberInput
            defaultValue={90}
            description="Set this key to expire after a certain number of days."
            required
            label="Key Expiration"
            max={365_000}
            min={1}
            name="expiry"
          />
          <div className="mt-6 flex items-center justify-between gap-2">
            <div>
              <Text className="font-semibold">Reusable</Text>
              <Text className="text-sm">Use this key to authenticate more than one device.</Text>
            </div>
            <Switch
              defaultChecked={reusable}
              label="Reusable"
              onCheckedChange={() => setReusable(!reusable)}
            />
          </div>
          <div className="mt-6 flex items-center justify-between gap-2">
            <div>
              <Text className="font-semibold">Ephemeral</Text>
              <Text className="text-sm">
                Devices authenticated with this key will be automatically removed once they go
                offline.{" "}
                <Link external styled to="https://tailscale.com/kb/1111/ephemeral-nodes">
                  Learn more
                </Link>
              </Text>
            </div>
            <Switch
              defaultChecked={ephemeral}
              label="Ephemeral"
              onCheckedChange={() => setEphemeral(!ephemeral)}
            />
          </div>
        </DialogPanel>
      )}
    </Dialog>
  );
}
