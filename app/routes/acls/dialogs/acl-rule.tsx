import { useEffect, useState } from "react";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Link from "~/components/link";
import Text from "~/components/text";
import Title from "~/components/title";
import { withDefaultPort, type AclRule } from "~/utils/acl-policy";

import TokenList from "../components/token-list";

interface AclRuleDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  rule?: AclRule;
  sources: string[];
  destinations: string[];
  onSave: (rule: AclRule) => void;
}

const EMPTY: AclRule = { action: "accept", src: [], dst: [] };

export default function AclRuleDialog({
  isOpen,
  setIsOpen,
  rule,
  sources,
  destinations,
  onSave,
}: AclRuleDialogProps) {
  const [draft, setDraft] = useState<AclRule>(rule ?? EMPTY);

  useEffect(() => {
    if (isOpen) {
      setDraft(rule ? structuredClone(rule) : structuredClone(EMPTY));
    }
  }, [isOpen, rule]);

  const isInvalid = draft.src.length === 0 || draft.dst.length === 0;

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel
        isDisabled={isInvalid}
        onSubmit={(event) => {
          event.preventDefault();
          // Destinations loaded from a hand-written policy may be missing their
          // port spec, which Headscale rejects. Fix them up on the way out.
          onSave({ ...draft, dst: draft.dst.map(withDefaultPort) });
          setIsOpen(false);
        }}
      >
        <Title>{rule ? "Edit access rule" : "New access rule"}</Title>
        <Text>
          Access rules allow traffic from a set of sources to a set of destinations. Destinations
          must include a port, for example <code className="font-mono">tag:web:80,443</code>. If you
          leave the port out, <code className="font-mono">:*</code> is added for you. See the{" "}
          <Link external styled to="https://tailscale.com/kb/1018/acls">
            Tailscale ACL guide
          </Link>{" "}
          for the full syntax.
        </Text>
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
      </DialogPanel>
    </Dialog>
  );
}
