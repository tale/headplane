import { Plus, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Link from "~/components/link";
import TableList from "~/components/table-list";
import Text from "~/components/text";
import Title from "~/components/title";
import { isValidGroupName } from "~/utils/acl-policy";
import cn from "~/utils/cn";

interface UserGroupsProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  // The Headscale username, which is what the ACL policy references.
  userName: string;
  displayName: string;
  groups: string[];
  // Every group defined in the policy, for one-click assignment.
  availableGroups: string[];
  // Whether the stored policy contains HuJSON comments, which saving drops.
  policyHasComments?: boolean;
}

export default function UserGroups({
  isOpen,
  setIsOpen,
  userName,
  displayName,
  groups,
  availableGroups,
  policyHasComments,
}: UserGroupsProps) {
  const fetcher = useFetcher<{ message?: string; error?: string }>();
  const submittingRef = useRef(false);
  const [selected, setSelected] = useState([...groups]);
  const [draft, setDraft] = useState("group:");

  const options = useMemo(
    () => availableGroups.filter((group) => !selected.includes(group)),
    [availableGroups, selected],
  );

  const draftIsInvalid = useMemo(
    () => !isValidGroupName(draft) || selected.includes(draft),
    [draft, selected],
  );

  const error = fetcher.data?.error;

  useEffect(() => {
    if (isOpen) {
      setSelected([...groups]);
      setDraft("group:");
    }
  }, [isOpen, groups]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      submittingRef.current = false;
      if (!fetcher.data.error) {
        setIsOpen(false);
      }
    }
  }, [fetcher.data, fetcher.state]);

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
      <DialogPanel
        isDisabled={fetcher.state !== "idle"}
        onSubmit={(event) => {
          event.preventDefault();
          submittingRef.current = true;
          const form = new FormData();
          form.set("action_id", "update_user_groups");
          form.set("user_name", userName);
          form.set("groups", selected.join(","));
          fetcher.submit(form, { method: "POST" });
        }}
      >
        <Title>Edit ACL groups for {displayName}</Title>
        <Text>
          Groups live in the ACL policy, not in Headscale. Changing them here rewrites the{" "}
          <code className="font-mono">groups</code> section of your policy. See the{" "}
          <Link external styled to="https://tailscale.com/kb/1018/acls">
            Tailscale ACL guide
          </Link>{" "}
          for details.
        </Text>
        {policyHasComments ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Your policy contains comments. Saving here rewrites the policy and drops them.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <TableList>
          {selected.length === 0 ? (
            <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
              <UsersRound />
              <p className="font-semibold">This user is not in any group</p>
            </TableList.Item>
          ) : (
            selected.map((group) => (
              <TableList.Item className="font-mono" id={group} key={group}>
                {group}
                <Button
                  className="rounded-md p-0.5"
                  onClick={() => setSelected(selected.filter((entry) => entry !== group))}
                  type="button"
                >
                  <X className="p-1" />
                </Button>
              </TableList.Item>
            ))
          )}
        </TableList>

        <div className="flex items-center gap-2">
          <Input
            aria-label="Add a group"
            className="w-full"
            invalid={draft.length > 0 && draftIsInvalid}
            label="Group"
            labelHidden
            onChange={setDraft}
            placeholder="group:example"
            value={draft}
          />
          <Button
            className={cn("rounded-md p-1", draftIsInvalid && "cursor-not-allowed opacity-50")}
            disabled={draftIsInvalid}
            onClick={() => {
              setSelected([...selected, draft]);
              setDraft("group:");
            }}
            type="button"
          >
            <Plus className="p-1" size={30} />
          </Button>
        </div>
        {options.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {options.map((group) => (
              <Button
                className="px-2 py-1 font-mono text-xs"
                key={group}
                onClick={() => setSelected([...selected, group])}
                type="button"
                variant="ghost"
              >
                {group}
              </Button>
            ))}
          </div>
        ) : null}
      </DialogPanel>
    </Dialog>
  );
}
