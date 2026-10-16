import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Link from "~/components/link";
import TokenList from "~/components/token-list";
import { isValidGroupName } from "~/utils/acl-policy";

interface UserGroupsProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  // The Headscale username, which is what the ACL policy references.
  userName: string;
  displayName: string;
  groups: string[];
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
  const [selected, setSelected] = useState([...groups]);
  const isUnchanged =
    selected.length === groups.length && selected.every((group) => groups.includes(group));

  return (
    <ActionDialog
      description={
        <>
          Groups live in the ACL policy, so saving rewrites its <Code>groups</Code> section.{" "}
          <Link external styled to="https://tailscale.com/kb/1018/acls">
            Docs
          </Link>
        </>
      }
      fields={{ user_name: userName }}
      intent="update_groups"
      isDisabled={isUnchanged}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Save groups"
      title={`Groups for ${displayName}`}
    >
      {selected.map((group) => (
        <input key={group} name="groups" type="hidden" value={group} />
      ))}
      <TokenList
        emptyText="This user isn't in any group"
        label="Groups"
        onChange={setSelected}
        placeholder="group:example"
        suggestions={availableGroups}
        validate={isValidGroupName}
        values={selected}
      />
      {policyHasComments && (
        <Callout variant="warning">
          Your policy has comments. Saving here rewrites the policy and drops them.
        </Callout>
      )}
    </ActionDialog>
  );
}
