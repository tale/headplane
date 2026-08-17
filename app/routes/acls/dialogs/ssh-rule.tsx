import { useEffect, useState } from "react";

import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Link from "~/components/link";
import Select from "~/components/select";
import Text from "~/components/text";
import Title from "~/components/title";
import type { SshRule } from "~/utils/acl-policy";

import TokenList from "../components/token-list";

interface SshRuleDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  rule?: SshRule;
  sources: string[];
  destinations: string[];
  onSave: (rule: SshRule) => void;
}

const EMPTY: SshRule = { action: "accept", src: [], dst: [], users: [] };
const SSH_USERS = ["root", "autogroup:nonroot"];

export default function SshRuleDialog({
  isOpen,
  setIsOpen,
  rule,
  sources,
  destinations,
  onSave,
}: SshRuleDialogProps) {
  const [draft, setDraft] = useState<SshRule>(rule ?? EMPTY);

  useEffect(() => {
    if (isOpen) {
      setDraft(rule ? structuredClone(rule) : structuredClone(EMPTY));
    }
  }, [isOpen, rule]);

  const isInvalid = draft.src.length === 0 || draft.dst.length === 0 || draft.users.length === 0;

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel
        isDisabled={isInvalid}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
          setIsOpen(false);
        }}
      >
        <Title>{rule ? "Edit SSH rule" : "New SSH rule"}</Title>
        <Text>
          SSH rules control Tailscale SSH access between nodes. Read the{" "}
          <Link external styled to="https://tailscale.com/kb/1193/tailscale-ssh">
            Tailscale SSH documentation
          </Link>{" "}
          for details about check mode.
        </Text>
        <Select
          items={[
            { value: "accept", label: "Accept — allow the session immediately" },
            { value: "check", label: "Check — require periodic re-authentication" },
          ]}
          label="Action"
          onValueChange={(value) =>
            setDraft({ ...draft, action: value === "check" ? "check" : "accept" })
          }
          value={draft.action}
        />
        <TokenList
          description="Who is allowed to open the SSH session."
          emptyText="No sources yet"
          label="Sources"
          onChange={(src) => setDraft({ ...draft, src })}
          placeholder="group:ops"
          suggestions={sources}
          values={draft.src}
        />
        <TokenList
          description="The nodes that accept the SSH session."
          emptyText="No destinations yet"
          label="Destinations"
          onChange={(dst) => setDraft({ ...draft, dst })}
          placeholder="tag:server"
          suggestions={destinations}
          values={draft.dst}
        />
        <TokenList
          description="The local Unix users that may be logged into."
          emptyText="No SSH users yet"
          label="SSH users"
          onChange={(users) => setDraft({ ...draft, users })}
          placeholder="autogroup:nonroot"
          suggestions={SSH_USERS}
          values={draft.users}
        />
        {draft.action === "check" ? (
          <Input
            description="How long a check-mode session stays valid, for example 12h."
            label="Check period"
            onChange={(checkPeriod) =>
              setDraft({ ...draft, checkPeriod: checkPeriod.length > 0 ? checkPeriod : undefined })
            }
            placeholder="12h"
            value={draft.checkPeriod ?? ""}
          />
        ) : null}
      </DialogPanel>
    </Dialog>
  );
}
