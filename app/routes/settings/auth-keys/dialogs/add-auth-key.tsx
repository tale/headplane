import { Key, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { User } from "~/types";

import Button from "~/components/Button";
import Code from "~/components/Code";
import Dialog from "~/components/Dialog";
import Link from "~/components/Link";
import NumberInput from "~/components/NumberInput";
import Select from "~/components/Select";
import Switch from "~/components/Switch";
import toast from "~/utils/toast";

interface AddAuthKeyProps {
  users: User[];
  url: string;
}

export default function AddAuthKey({ users, url }: AddAuthKeyProps) {
  const fetcher = useFetcher();
  const submittingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [userId, setUserId] = useState<Key | null>(users[0]?.id);

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
      setUserId(users[0]?.id);
      fetcher.data = undefined;
    }
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && submittingRef.current) return;
        setIsOpen(open);
      }}
    >
      <Button className="my-4" onPress={() => setIsOpen(true)}>
        Create pre-auth key
      </Button>
      {createdKey ? (
        <Dialog.Panel variant="unactionable">
          <Dialog.Title>Pre-auth key created</Dialog.Title>
          <Dialog.Text>
            Copy this key now. You will not be able to see the full key again.
          </Dialog.Text>
          <div className="bg-headplane-100 dark:bg-headplane-800 mt-4 flex items-center gap-2 rounded-lg px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{createdKey}</code>
            <Button
              className="shrink-0"
              onPress={async () => {
                await navigator.clipboard.writeText(createdKey);
                toast("Copied key to clipboard");
              }}
              variant="light"
            >
              Copy
            </Button>
          </div>
          <Dialog.Text className="mt-4 text-sm">To register a device with this key:</Dialog.Text>
          <Code isCopyable className="mt-1 block text-sm">
            {`tailscale up --login-server=${url} --authkey ${createdKey}`}
          </Code>
        </Dialog.Panel>
      ) : (
        <Dialog.Panel
          onSubmit={(event) => {
            event.preventDefault();
            submittingRef.current = true;
            const form = new FormData(event.currentTarget as HTMLFormElement);
            form.set("action_id", "add_preauthkey");
            form.set("user_id", userId?.toString() ?? "");
            form.set("reusable", reusable ? "on" : "off");
            form.set("ephemeral", ephemeral ? "on" : "off");
            fetcher.submit(form, { method: "POST" });
          }}
          isDisabled={fetcher.state !== "idle"}
        >
          <Dialog.Title>Generate auth key</Dialog.Title>
          <Select
            className="mb-2"
            description="This is the user machines will belong to when they authenticate."
            isRequired
            label="User"
            onSelectionChange={(value) => {
              setUserId(value);
            }}
            placeholder="Select a user"
          >
            {users.map((user) => (
              <Select.Item key={user.id}>
                {user.name || user.displayName || user.email || user.id}
              </Select.Item>
            ))}
          </Select>
          <NumberInput
            defaultValue={90}
            description="Set this key to expire after a certain number of days."
            formatOptions={{
              style: "unit",
              unit: "day",
              unitDisplay: "short",
            }}
            isRequired
            label="Key Expiration"
            maxValue={365_000}
            minValue={1}
            name="expiry"
          />
          <div className="mt-6 flex items-center justify-between gap-2">
            <div>
              <Dialog.Text className="font-semibold">Reusable</Dialog.Text>
              <Dialog.Text className="text-sm">
                Use this key to authenticate more than one device.
              </Dialog.Text>
            </div>
            <Switch
              defaultSelected={reusable}
              label="Reusable"
              onChange={() => {
                setReusable(!reusable);
              }}
            />
          </div>
          <div className="mt-6 flex items-center justify-between gap-2">
            <div>
              <Dialog.Text className="font-semibold">Ephemeral</Dialog.Text>
              <Dialog.Text className="text-sm">
                Devices authenticated with this key will be automatically removed once they go
                offline.{" "}
                <Link
                  name="Tailscale Ephemeral Nodes Documentation"
                  to="https://tailscale.com/kb/1111/ephemeral-nodes"
                >
                  Learn more
                </Link>
              </Dialog.Text>
            </div>
            <Switch
              defaultSelected={ephemeral}
              label="Ephemeral"
              onChange={() => {
                setEphemeral(!ephemeral);
              }}
            />
          </div>
        </Dialog.Panel>
      )}
    </Dialog>
  );
}
