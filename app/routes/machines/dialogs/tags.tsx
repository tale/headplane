import { useState } from "react";

import ActionDialog from "~/components/action-dialog";
import Callout from "~/components/callout";
import Code from "~/components/code";
import Link from "~/components/link";
import TokenList from "~/components/token-list";
import type { Machine } from "~/types";

interface TagsProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  existingTags?: string[];
  // Tags declared under `tagOwners`. Others are assignable but match no rule.
  policyTags?: string[];
}

export default function Tags({ machine, isOpen, setIsOpen, existingTags, policyTags }: TagsProps) {
  const [tags, setTags] = useState([...machine.tags]);
  const undeclaredTags =
    policyTags === undefined ? [] : tags.filter((tag) => !policyTags.includes(tag));
  const isUnchanged =
    tags.length === machine.tags.length && tags.every((tag) => machine.tags.includes(tag));

  return (
    <ActionDialog
      description={
        <>
          Tags let your access control policy refer to machines by role.{" "}
          <Link external styled to="https://tailscale.com/kb/1068/acl-tags">
            Docs
          </Link>
        </>
      }
      fields={{ node_id: machine.id }}
      intent="update_tags"
      isDisabled={isUnchanged}
      onOpenChange={setIsOpen}
      open={isOpen}
      submitLabel="Save tags"
      title={`Tags for ${machine.givenName}`}
    >
      {tags.map((tag) => (
        <input key={tag} name="tags" type="hidden" value={tag} />
      ))}
      <TokenList
        emptyText="No tags on this machine"
        label="Tags"
        normalize={(value) => (value.startsWith("tag:") ? value : `tag:${value}`)}
        onChange={setTags}
        placeholder="tag:server"
        suggestions={existingTags}
        validate={(value) => /^tag:\S+$/.test(value)}
        values={tags}
      />
      {undeclaredTags.length > 0 && (
        <Callout variant="warning">
          {undeclaredTags.join(", ")} {undeclaredTags.length === 1 ? "isn't" : "aren't"} declared
          under <Code>tagOwners</Code>, so no rule will match{" "}
          {undeclaredTags.length === 1 ? "it" : "them"}. Declare{" "}
          {undeclaredTags.length === 1 ? "it" : "them"} in{" "}
          <Link styled to="/acls">
            Access Control
          </Link>
          .
        </Callout>
      )}
    </ActionDialog>
  );
}
