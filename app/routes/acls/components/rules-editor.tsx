import { ArrowRight, KeyRound, Route, Terminal } from "lucide-react";
import { useState } from "react";

import Chip from "~/components/chip";
import List from "~/components/list";
import type { AclRule, Grant, Policy, SshRule } from "~/utils/acl-policy";

import AclRuleDialog from "../dialogs/acl-rule";
import AutoApproverDialog, { type ApproverTarget } from "../dialogs/auto-approver";
import GrantDialog from "../dialogs/grant";
import HostDialog from "../dialogs/host";
import SshRuleDialog from "../dialogs/ssh-rule";
import { Empty, RowActions, Section } from "./editor-section";

interface RulesEditorProps {
  policy: Policy;
  onChange: (policy: Policy) => void;
  isDisabled: boolean;
  canEditGrants: boolean;
  sources: string[];
  destinations: string[];
}

type Editing =
  | { kind: "acl"; index: number | null }
  | { kind: "ssh"; index: number | null }
  | { kind: "grant"; index: number | null }
  | { kind: "approver"; target?: ApproverTarget }
  | { kind: "host"; name: string | null }
  | null;

export default function RulesEditor({
  policy,
  onChange,
  isDisabled,
  canEditGrants,
  sources,
  destinations,
}: RulesEditorProps) {
  const [editing, setEditing] = useState<Editing>(null);

  const aclRule =
    editing?.kind === "acl" && editing.index !== null ? policy.acls[editing.index] : undefined;
  const sshRule =
    editing?.kind === "ssh" && editing.index !== null ? policy.ssh[editing.index] : undefined;
  const hostName = editing?.kind === "host" ? editing.name : null;
  const grant =
    editing?.kind === "grant" && editing.index !== null ? policy.grants[editing.index] : undefined;
  const { autoApprovers } = policy;

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

  function saveGrant(next: Grant) {
    const grants = [...policy.grants];
    if (editing?.kind === "grant" && editing.index !== null) {
      grants[editing.index] = next;
    } else {
      grants.push(next);
    }
    onChange({ ...policy, grants });
  }

  function setApprovers(target: ApproverTarget, approvers: string[]) {
    if (target === null) {
      onChange({ ...policy, autoApprovers: { ...autoApprovers, exitNode: approvers } });
      return;
    }

    const routes = { ...autoApprovers.routes };
    const previous = editing?.kind === "approver" ? editing.target : undefined;
    if (typeof previous === "string" && previous !== target) {
      delete routes[previous];
    }
    if (approvers.length > 0) {
      routes[target] = approvers;
    } else {
      delete routes[target];
    }
    onChange({ ...policy, autoApprovers: { ...autoApprovers, routes } });
  }

  // Hosts and autogroups cannot approve routes.
  const approverSuggestions = sources.filter(
    (source) => source !== "*" && !source.startsWith("autogroup:") && !(source in policy.hosts),
  );
  const approverTarget = editing?.kind === "approver" ? editing.target : undefined;
  const approverEntries: [ApproverTarget, string[]][] = [
    ...Object.entries(autoApprovers.routes),
    ...(autoApprovers.exitNode.length > 0
      ? [[null, autoApprovers.exitNode] as [ApproverTarget, string[]]]
      : []),
  ];

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
      {editing?.kind === "grant" ? (
        <GrantDialog
          destinations={destinations}
          grant={grant}
          isOpen
          onSave={saveGrant}
          setIsOpen={(open) => {
            if (!open) setEditing(null);
          }}
          sources={sources}
        />
      ) : null}
      {editing?.kind === "approver" ? (
        <AutoApproverDialog
          approvers={
            approverTarget === undefined
              ? undefined
              : approverTarget === null
                ? autoApprovers.exitNode
                : autoApprovers.routes[approverTarget]
          }
          existingRoutes={Object.keys(autoApprovers.routes)}
          exitNodeApprovers={autoApprovers.exitNode}
          isOpen
          onSave={setApprovers}
          setIsOpen={(open) => {
            if (!open) setEditing(null);
          }}
          suggestions={approverSuggestions}
          target={approverTarget}
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
            <List.Item
              className="flex-col items-stretch gap-2 py-3 md:flex-row md:items-center"
              key={`acl-${index}`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {/* An unknown action is shown verbatim, never relabelled. */}
                <span className="text-xs font-semibold uppercase opacity-60">
                  {rule.action === "accept" ? "Allow" : rule.action}
                </span>
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
            </List.Item>
          ))
        )}
      </Section>

      {canEditGrants ? (
        <Section
          description="Grants allow traffic like access rules, with ports and protocols set separately. Headscale combines them with the access rules."
          isDisabled={isDisabled}
          onAdd={() => setEditing({ kind: "grant", index: null })}
          title="Grants"
        >
          {policy.grants.length === 0 ? (
            <Empty text="No grants are defined yet." />
          ) : (
            policy.grants.map((entry, index) => (
              <List.Item
                className="flex-col items-stretch gap-2 py-3 md:flex-row md:items-center"
                key={`grant-${index}`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <KeyRound className="h-4 w-4 shrink-0 opacity-60" />
                  <ChipRow values={entry.src} />
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                  <ChipRow values={entry.dst} />
                  {entry.ip.length > 0 ? (
                    <>
                      <span className="text-xs opacity-60">on</span>
                      <ChipRow values={entry.ip} />
                    </>
                  ) : null}
                  {entry.via.length > 0 ? (
                    <>
                      <span className="text-xs opacity-60">via</span>
                      <ChipRow values={entry.via} />
                    </>
                  ) : null}
                  {"app" in entry.extra ? <Chip text="app capabilities" /> : null}
                </div>
                <RowActions
                  isDisabled={isDisabled}
                  onDelete={() =>
                    onChange({ ...policy, grants: policy.grants.filter((_, i) => i !== index) })
                  }
                  onEdit={() => setEditing({ kind: "grant", index })}
                />
              </List.Item>
            ))
          )}
        </Section>
      ) : null}

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
            <List.Item
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
            </List.Item>
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
            <List.Item key={name}>
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
            </List.Item>
          ))
        )}
      </Section>

      <Section
        description="Subnet routes and exit nodes advertised by these users, groups or tags are approved automatically."
        isDisabled={isDisabled}
        onAdd={() => setEditing({ kind: "approver" })}
        title="Auto approvers"
      >
        {approverEntries.length === 0 ? (
          <Empty text="No auto approvers are defined yet." />
        ) : (
          approverEntries.map(([target, approvers]) => (
            <List.Item key={target ?? "exit-node"}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Route className="h-4 w-4 shrink-0 opacity-60" />
                <span className={target === null ? "text-sm" : "font-mono text-sm"}>
                  {target ?? "Exit nodes"}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />
                <ChipRow values={approvers} />
              </div>
              <RowActions
                isDisabled={isDisabled}
                onDelete={() => {
                  if (target === null) {
                    onChange({ ...policy, autoApprovers: { ...autoApprovers, exitNode: [] } });
                    return;
                  }
                  const routes = { ...autoApprovers.routes };
                  delete routes[target];
                  onChange({ ...policy, autoApprovers: { ...autoApprovers, routes } });
                }}
                onEdit={() => setEditing({ kind: "approver", target })}
              />
            </List.Item>
          ))
        )}
      </Section>
    </div>
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
