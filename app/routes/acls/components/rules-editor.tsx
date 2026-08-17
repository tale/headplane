import { ArrowRight, Pencil, Plus, Terminal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import Button from "~/components/button";
import Chip from "~/components/chip";
import TableList from "~/components/table-list";
import type { AclRule, Policy, SshRule } from "~/utils/acl-policy";
import cn from "~/utils/cn";

import AclRuleDialog from "../dialogs/acl-rule";
import HostDialog from "../dialogs/host";
import SshRuleDialog from "../dialogs/ssh-rule";

interface RulesEditorProps {
  policy: Policy;
  onChange: (policy: Policy) => void;
  isDisabled: boolean;
  sources: string[];
  destinations: string[];
}

type Editing =
  | { kind: "acl"; index: number | null }
  | { kind: "ssh"; index: number | null }
  | { kind: "host"; name: string | null }
  | null;

export default function RulesEditor({
  policy,
  onChange,
  isDisabled,
  sources,
  destinations,
}: RulesEditorProps) {
  const [editing, setEditing] = useState<Editing>(null);

  const aclRule =
    editing?.kind === "acl" && editing.index !== null ? policy.acls[editing.index] : undefined;
  const sshRule =
    editing?.kind === "ssh" && editing.index !== null ? policy.ssh[editing.index] : undefined;
  const hostName = editing?.kind === "host" ? editing.name : null;

  function saveAcl(rule: AclRule) {
    const acls = [...policy.acls];
    if (editing?.kind === "acl" && editing.index !== null) {
      acls[editing.index] = rule;
    } else {
      acls.push(rule);
    }
    onChange({ ...policy, acls });
  }

  function saveSsh(rule: SshRule) {
    const ssh = [...policy.ssh];
    if (editing?.kind === "ssh" && editing.index !== null) {
      ssh[editing.index] = rule;
    } else {
      ssh.push(rule);
    }
    onChange({ ...policy, ssh });
  }

  function saveHost(name: string, value: string) {
    const hosts = { ...policy.hosts };
    if (hostName !== null && hostName !== name) {
      delete hosts[hostName];
    }
    hosts[name] = value;
    onChange({ ...policy, hosts });
  }

  const hostEntries = Object.entries(policy.hosts).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-8">
      {editing?.kind === "acl" ? (
        <AclRuleDialog
          destinations={destinations}
          isOpen
          onSave={saveAcl}
          rule={aclRule}
          setIsOpen={(open) => {
            if (!open) setEditing(null);
          }}
          sources={sources}
        />
      ) : null}
      {editing?.kind === "ssh" ? (
        <SshRuleDialog
          destinations={destinations}
          isOpen
          onSave={saveSsh}
          rule={sshRule}
          setIsOpen={(open) => {
            if (!open) setEditing(null);
          }}
          sources={sources}
        />
      ) : null}
      {editing?.kind === "host" ? (
        <HostDialog
          existingNames={Object.keys(policy.hosts)}
          isOpen
          name={hostName ?? undefined}
          onSave={saveHost}
          setIsOpen={(open) => {
            if (!open) setEditing(null);
          }}
          value={hostName ? policy.hosts[hostName] : undefined}
        />
      ) : null}

      <Section
        description="Rules are evaluated top to bottom. Traffic is denied unless a rule allows it."
        isDisabled={isDisabled}
        onAdd={() => setEditing({ kind: "acl", index: null })}
        title="Access rules"
      >
        {policy.acls.length === 0 ? (
          <Empty text="No access rules are defined yet." />
        ) : (
          policy.acls.map((rule, index) => (
            <TableList.Item
              className="flex-col items-stretch gap-2 py-3 md:flex-row md:items-center"
              key={`acl-${index}`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase opacity-60">Allow</span>
                <ChipRow values={rule.src} />
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                <ChipRow values={rule.dst} />
                {rule.proto ? <Chip className="uppercase" text={rule.proto} /> : null}
              </div>
              <RowActions
                isDisabled={isDisabled}
                onDelete={() =>
                  onChange({ ...policy, acls: policy.acls.filter((_, i) => i !== index) })
                }
                onEdit={() => setEditing({ kind: "acl", index })}
              />
            </TableList.Item>
          ))
        )}
      </Section>

      <Section
        description="Control which nodes can be reached over Tailscale SSH and as which local user."
        isDisabled={isDisabled}
        onAdd={() => setEditing({ kind: "ssh", index: null })}
        title="SSH rules"
      >
        {policy.ssh.length === 0 ? (
          <Empty text="No SSH rules are defined yet." />
        ) : (
          policy.ssh.map((rule, index) => (
            <TableList.Item
              className="flex-col items-stretch gap-2 py-3 md:flex-row md:items-center"
              key={`ssh-${index}`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Terminal className="h-4 w-4 shrink-0 opacity-60" />
                <span className="text-xs font-semibold uppercase opacity-60">{rule.action}</span>
                <ChipRow values={rule.src} />
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                <ChipRow values={rule.dst} />
                <span className="text-xs opacity-60">as</span>
                <ChipRow values={rule.users} />
              </div>
              <RowActions
                isDisabled={isDisabled}
                onDelete={() =>
                  onChange({ ...policy, ssh: policy.ssh.filter((_, i) => i !== index) })
                }
                onEdit={() => setEditing({ kind: "ssh", index })}
              />
            </TableList.Item>
          ))
        )}
      </Section>

      <Section
        description="Named IP addresses and CIDR ranges that can be referenced from rules."
        isDisabled={isDisabled}
        onAdd={() => setEditing({ kind: "host", name: null })}
        title="Hosts"
      >
        {hostEntries.length === 0 ? (
          <Empty text="No hosts are defined yet." />
        ) : (
          hostEntries.map(([name, value]) => (
            <TableList.Item key={name}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sm">{name}</span>
                <span className="font-mono text-sm opacity-60">{value}</span>
              </div>
              <RowActions
                isDisabled={isDisabled}
                onDelete={() => {
                  const hosts = { ...policy.hosts };
                  delete hosts[name];
                  onChange({ ...policy, hosts });
                }}
                onEdit={() => setEditing({ kind: "host", name })}
              />
            </TableList.Item>
          ))
        )}
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  isDisabled: boolean;
  onAdd: () => void;
  children: ReactNode;
}

function Section({ title, description, isDisabled, onAdd, children }: SectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-mist-600 dark:text-mist-300">{description}</p>
        </div>
        <Button className="shrink-0" disabled={isDisabled} onClick={onAdd} type="button">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <TableList>{children}</TableList>
    </section>
  );
}

function ChipRow({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {values.map((value) => (
        <Chip className="font-mono" key={value} text={value} />
      ))}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <TableList.Item className={cn("justify-center py-6 text-sm opacity-70")}>{text}</TableList.Item>
  );
}

function RowActions({
  isDisabled,
  onEdit,
  onDelete,
}: {
  isDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        aria-label="Edit"
        className="rounded-md p-1"
        disabled={isDisabled}
        onClick={onEdit}
        type="button"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Delete"
        className="rounded-md p-1"
        disabled={isDisabled}
        onClick={onDelete}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
