import { useState } from "react";

import Link from "~/components/link";
import TokenList from "~/components/token-list";
import { isValidTagName, type Grant } from "~/utils/acl-policy";

import EditorDialog from "./editor-dialog";

interface GrantDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  grant?: Grant;
  sources: string[];
  destinations: string[];
  onSave: (grant: Grant) => void;
}

const EMPTY: Grant = { src: [], dst: [], ip: ["*"], via: [], extra: {} };
const IP_SUGGESTIONS = ["*", "tcp:22", "tcp:80", "tcp:443", "udp:53", "icmp"];

export default function GrantDialog({
  isOpen,
  setIsOpen,
  grant,
  sources,
  destinations,
  onSave,
}: GrantDialogProps) {
  const [draft, setDraft] = useState<Grant>(() => structuredClone(grant ?? EMPTY));

  // A grant that only carries app capabilities has no `ip`.
  const isInvalid =
    draft.src.length === 0 ||
    draft.dst.length === 0 ||
    (draft.ip.length === 0 && !("app" in draft.extra));

  return (
    <EditorDialog
      description={
        <>
          Grants allow traffic from a set of sources to a set of destinations. Unlike access rules,
          ports and protocols are set separately from the destination. App capabilities are kept but
          can only be edited in the file. See the{" "}
          <Link external styled to="https://tailscale.com/kb/1324/grants">
            Tailscale grants guide
          </Link>{" "}
          for the full syntax.
        </>
      }
      isDisabled={isInvalid}
      isOpen={isOpen}
      onSubmit={() => onSave(draft)}
      setIsOpen={setIsOpen}
      submitLabel={grant ? "Update grant" : "Add grant"}
      title={grant ? "Edit grant" : "New grant"}
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
        description="Where the traffic is allowed to go, without a port."
        emptyText="No destinations yet"
        label="Destinations"
        onChange={(dst) => setDraft({ ...draft, dst })}
        placeholder="tag:web"
        suggestions={destinations}
        values={draft.dst}
      />
      <TokenList
        description="Ports and protocols, for example tcp:443 or * for everything."
        emptyText="No ports yet"
        label="Ports and protocols"
        onChange={(ip) => setDraft({ ...draft, ip })}
        placeholder="tcp:443"
        suggestions={IP_SUGGESTIONS}
        values={draft.ip}
      />
      <TokenList
        description="Optional. Tags of the subnet routers or exit nodes the traffic must go through. For exit nodes, use autogroup:internet as the destination. Only tags are allowed."
        emptyText="Traffic is not routed through a specific node"
        label="Via"
        onChange={(via) => setDraft({ ...draft, via })}
        placeholder="tag:router"
        suggestions={sources.filter((source) => source.startsWith("tag:"))}
        validate={isValidTagName}
        values={draft.via}
      />
    </EditorDialog>
  );
}
