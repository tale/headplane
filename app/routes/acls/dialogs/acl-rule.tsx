import { useState } from "react";

import Input from "~/components/input";
import Link from "~/components/link";
import TokenList from "~/components/token-list";
import { withDefaultPort, type AclRule } from "~/utils/acl-policy";

import EditorDialog from "./editor-dialog";

interface AclRuleDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  rule?: AclRule;
  sources: string[];
  destinations: string[];
  onSave: (rule: AclRule) => void;
}

const EMPTY: AclRule = { action: "accept", src: [], dst: [], extra: {} };

export default function AclRuleDialog({
  isOpen,
  setIsOpen,
  rule,
  sources,
  destinations,
  onSave,
}: AclRuleDialogProps) {
  const [draft, setDraft] = useState<AclRule>(() => structuredClone(rule ?? EMPTY));

  const isInvalid = draft.src.length === 0 || draft.dst.length === 0;

  return (
    <EditorDialog
      description={
        <>
          Access rules allow traffic from a set of sources to a set of destinations. Destinations
          must include a port, for example <code className="font-mono">tag:web:80,443</code>. If you
          leave the port out, <code className="font-mono">:*</code> is added for you. See the{" "}
          <Link external styled to="https://tailscale.com/kb/1018/acls">
            Tailscale ACL guide
          </Link>{" "}
          for the full syntax.
        </>
      }
      isDisabled={isInvalid}
      isOpen={isOpen}
      onSubmit={() => {
        // A hand-written policy may be missing the port spec Headscale wants.
        onSave({ ...draft, dst: draft.dst.map(withDefaultPort) });
      }}
      setIsOpen={setIsOpen}
      submitLabel={rule ? "Update rule" : "Add rule"}
      title={rule ? "Edit access rule" : "New access rule"}
    >
      <TokenList
        description="Groups, tags, hosts, users or autogroups allowed to initiate the connection."
        emptyText="No sources yet"
        label="Sources"
        onChange={(src) => setDraft({ ...draft, src })}
        placeholder="group:eng"
        suggestions={sources}
        values={draft.src}
      />
      <TokenList
        description="Where the traffic is allowed to go. A destination without a port becomes :* (all ports)."
        emptyText="No destinations yet"
        label="Destinations"
        normalize={withDefaultPort}
        onChange={(dst) => setDraft({ ...draft, dst })}
        placeholder="tag:web:80,443"
        suggestions={destinations}
        values={draft.dst}
      />
      <Input
        description="Optional. Restricts the rule to a single protocol (tcp, udp, icmp, ...)."
        label="Protocol"
        onChange={(proto) => setDraft({ ...draft, proto: proto.length > 0 ? proto : undefined })}
        placeholder="tcp"
        value={draft.proto ?? ""}
      />
    </EditorDialog>
  );
}
