import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import Button from "~/components/button";
import Chip from "~/components/chip";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import TableList from "~/components/table-list";
import {
  type AclPolicy,
  type AclRule,
  type AclTest,
  type SshRule,
  addAclRule,
  addAclTest,
  addSshRule,
  groupKey,
  parsePolicy,
  removeAclRule,
  removeAclTest,
  removeAutoApproveExitNode,
  removeAutoApproveRoute,
  removeGroup,
  removeHost,
  removeSshRule,
  removeTagOwner,
  setAutoApproveExitNode,
  setAutoApproveRoute,
  setGroup,
  setHost,
  setTagOwner,
  stringifyPolicy,
  tagKey,
  updateAclRule,
  updateAclTest,
  updateSshRule,
} from "~/utils/acl-editor";

function split(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function join(v: string[]): string {
  return v.join(", ");
}

function Tags({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Chip key={v} text={v} />
      ))}
    </div>
  );
}

function KeyListRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <Tags values={values} />
    </div>
  );
}

type ArrayDialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; index: number }
  | { mode: "delete"; index: number };

interface ArraySectionProps<T> {
  title: string;
  emptyText: string;
  items: T[];
  renderRow: (item: T) => ReactNode;
  renderForm: (item: T | undefined) => ReactNode;
  parseForm: (fd: FormData) => T;
  onAdd: (item: T) => void;
  onUpdate: (index: number, item: T) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function ArraySection<T>({
  title,
  emptyText,
  items,
  renderRow,
  renderForm,
  parseForm,
  onAdd,
  onUpdate,
  onRemove,
  disabled,
}: ArraySectionProps<T>) {
  const [dialog, setDialog] = useState<ArrayDialogState>({ mode: "closed" });
  const close = () => setDialog({ mode: "closed" });
  const editing = dialog.mode === "edit" ? items[dialog.index] : undefined;
  const isEditing = dialog.mode === "edit";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const item = parseForm(new FormData(e.currentTarget));
    if (dialog.mode === "add") onAdd(item);
    else if (dialog.mode === "edit") onUpdate(dialog.index, item);
    close();
  }

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (dialog.mode === "delete") onRemove(dialog.index);
    close();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button variant="ghost" disabled={disabled} onClick={() => setDialog({ mode: "add" })}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-mist-500">{emptyText}</p>
      ) : (
        <TableList>
          {items.map((item, i) => (
            <TableList.Item key={i}>
              {renderRow(item)}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setDialog({ mode: "edit", index: i })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setDialog({ mode: "delete", index: i })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </TableList.Item>
          ))}
        </TableList>
      )}

      <Dialog
        isOpen={dialog.mode === "add" || dialog.mode === "edit"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogPanel
          key={dialog.mode === "edit" ? `edit-${dialog.index}` : "add"}
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-medium">{isEditing ? `Edit ${title}` : `Add ${title}`}</h2>
          {renderForm(editing)}
        </DialogPanel>
      </Dialog>

      <Dialog isOpen={dialog.mode === "delete"} onOpenChange={(open) => !open && close()}>
        <DialogPanel variant="destructive" onSubmit={handleDelete}>
          <h2 className="text-lg font-medium">Remove {title.toLowerCase().replace(/s$/, "")}</h2>
          <p className="text-sm text-mist-600 dark:text-mist-300">
            This will remove the item from the policy. You can discard all changes to undo.
          </p>
        </DialogPanel>
      </Dialog>
    </div>
  );
}

type RecordDialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; key: string }
  | { mode: "delete"; key: string };

interface RecordSectionProps<V> {
  title: string;
  emptyText: string;
  entries: [string, V][];
  renderRow: (key: string, value: V) => ReactNode;
  renderForm: (key: string | undefined, value: V | undefined) => ReactNode;
  parseForm: (fd: FormData) => { key: string; value: V };
  onSet: (key: string, value: V) => void;
  onRename: (oldKey: string, newKey: string, value: V) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
}

function RecordSection<V>({
  title,
  emptyText,
  entries,
  renderRow,
  renderForm,
  parseForm,
  onSet,
  onRename,
  onRemove,
  disabled,
}: RecordSectionProps<V>) {
  const [dialog, setDialog] = useState<RecordDialogState>({ mode: "closed" });
  const close = () => setDialog({ mode: "closed" });
  const editKey = dialog.mode === "edit" ? dialog.key : undefined;
  const editValue = editKey ? entries.find(([k]) => k === editKey)?.[1] : undefined;
  const isEditing = dialog.mode === "edit";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { key, value } = parseForm(new FormData(e.currentTarget));
    if (dialog.mode === "edit" && editKey && editKey !== key) {
      onRename(editKey, key, value);
    } else {
      onSet(key, value);
    }
    close();
  }

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (dialog.mode === "delete") onRemove(dialog.key);
    close();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button variant="ghost" disabled={disabled} onClick={() => setDialog({ mode: "add" })}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-mist-500">{emptyText}</p>
      ) : (
        <TableList>
          {entries.map(([key, value]) => (
            <TableList.Item key={key}>
              {renderRow(key, value)}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setDialog({ mode: "edit", key })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setDialog({ mode: "delete", key })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </TableList.Item>
          ))}
        </TableList>
      )}

      <Dialog
        isOpen={dialog.mode === "add" || dialog.mode === "edit"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogPanel key={editKey ?? "add"} onSubmit={handleSubmit}>
          <h2 className="text-lg font-medium">{isEditing ? `Edit ${title}` : `Add ${title}`}</h2>
          {renderForm(editKey, editValue)}
        </DialogPanel>
      </Dialog>

      <Dialog isOpen={dialog.mode === "delete"} onOpenChange={(open) => !open && close()}>
        <DialogPanel variant="destructive" onSubmit={handleDelete}>
          <h2 className="text-lg font-medium">Remove {title.toLowerCase().replace(/s$/, "")}</h2>
          <p className="text-sm text-mist-600 dark:text-mist-300">
            This will remove <strong>{dialog.mode === "delete" ? dialog.key : ""}</strong> from the
            policy. You can discard all changes to undo.
          </p>
        </DialogPanel>
      </Dialog>
    </div>
  );
}

interface VisualEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function VisualEditor({ value, onChange, disabled }: VisualEditorProps) {
  const policy = parsePolicy(value);
  const emit = (p: AclPolicy) => onChange(stringifyPolicy(p));

  return (
    <div className="space-y-8">
      <ArraySection<AclRule>
        title="ACL Rules"
        emptyText="No ACL rules defined"
        disabled={disabled}
        items={policy.acls ?? []}
        renderRow={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <Tags values={r.src} />
              <span className="text-mist-400">→</span>
              <Tags values={r.dst} />
            </div>
            {r.proto && <span className="text-xs text-mist-500">{r.proto}</span>}
          </div>
        )}
        renderForm={(item) => (
          <>
            <Input
              name="src"
              label="Sources"
              required
              defaultValue={item ? join(item.src) : ""}
              placeholder="*, group:admin, user1"
            />
            <Input
              name="dst"
              label="Destinations"
              required
              defaultValue={item ? join(item.dst) : ""}
              placeholder="*:*, tag:web:443"
            />
            <Input
              name="proto"
              label="Protocol"
              defaultValue={item?.proto ?? ""}
              placeholder="tcp, udp (optional)"
            />
          </>
        )}
        parseForm={(fd) => ({
          action: "accept" as const,
          src: split(fd.get("src") as string),
          dst: split(fd.get("dst") as string),
          ...((fd.get("proto") as string)?.trim()
            ? { proto: (fd.get("proto") as string).trim() }
            : {}),
        })}
        onAdd={(rule) => emit(addAclRule(policy, rule))}
        onUpdate={(i, rule) => emit(updateAclRule(policy, i, rule))}
        onRemove={(i) => emit(removeAclRule(policy, i))}
      />

      <RecordSection<string[]>
        title="Groups"
        emptyText="No groups defined"
        disabled={disabled}
        entries={Object.entries(policy.groups ?? {})}
        renderRow={(key, members) => <KeyListRow label={key} values={members} />}
        renderForm={(key, members) => (
          <>
            <Input
              name="name"
              label="Group name"
              required
              defaultValue={key?.replace(/^group:/, "") ?? ""}
              placeholder="admin, dev"
            />
            <Input
              name="members"
              label="Members"
              required
              defaultValue={members ? join(members) : ""}
              placeholder="user1, user2"
            />
          </>
        )}
        parseForm={(fd) => ({
          key: groupKey((fd.get("name") as string).trim()),
          value: split(fd.get("members") as string),
        })}
        onSet={(key, members) => emit(setGroup(policy, key, members))}
        onRename={(oldKey, newKey, members) =>
          emit(setGroup(removeGroup(policy, oldKey), newKey, members))
        }
        onRemove={(key) => emit(removeGroup(policy, key))}
      />

      <RecordSection<string>
        title="Hosts"
        emptyText="No host aliases defined"
        disabled={disabled}
        entries={Object.entries(policy.hosts ?? {})}
        renderRow={(name, addr) => (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{name}</span>
            <span className="text-mist-400">→</span>
            <span className="text-mist-600 dark:text-mist-300">{addr}</span>
          </div>
        )}
        renderForm={(key, addr) => (
          <>
            <Input
              name="name"
              label="Hostname"
              required
              defaultValue={key ?? ""}
              placeholder="server1, gateway"
            />
            <Input
              name="address"
              label="IP Address"
              required
              defaultValue={addr ?? ""}
              placeholder="100.64.0.1"
            />
          </>
        )}
        parseForm={(fd) => ({
          key: (fd.get("name") as string).trim(),
          value: (fd.get("address") as string).trim(),
        })}
        onSet={(name, addr) => emit(setHost(policy, name, addr))}
        onRename={(oldKey, newKey, addr) => emit(setHost(removeHost(policy, oldKey), newKey, addr))}
        onRemove={(name) => emit(removeHost(policy, name))}
      />

      <RecordSection<string[]>
        title="Tag Owners"
        emptyText="No tag owners defined"
        disabled={disabled}
        entries={Object.entries(policy.tagOwners ?? {})}
        renderRow={(tag, owners) => <KeyListRow label={tag} values={owners} />}
        renderForm={(key, owners) => (
          <>
            <Input
              name="tag"
              label="Tag name"
              required
              defaultValue={key?.replace(/^tag:/, "") ?? ""}
              placeholder="server, ci"
            />
            <Input
              name="owners"
              label="Owners"
              required
              defaultValue={owners ? join(owners) : ""}
              placeholder="group:admin, user1"
            />
          </>
        )}
        parseForm={(fd) => ({
          key: tagKey((fd.get("tag") as string).trim()),
          value: split(fd.get("owners") as string),
        })}
        onSet={(tag, owners) => emit(setTagOwner(policy, tag, owners))}
        onRename={(oldKey, newKey, owners) =>
          emit(setTagOwner(removeTagOwner(policy, oldKey), newKey, owners))
        }
        onRemove={(tag) => emit(removeTagOwner(policy, tag))}
      />

      <ArraySection<SshRule>
        title="SSH Rules"
        emptyText="No SSH rules defined"
        disabled={disabled}
        items={policy.ssh ?? []}
        renderRow={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <Chip
                text={r.action}
                className={
                  r.action === "check"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                    : ""
                }
              />
              <Tags values={r.src} />
              <span className="text-mist-400">→</span>
              <Tags values={r.dst} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-mist-500">
              <span>as</span>
              <Tags values={r.users} />
              {r.checkPeriod && <span>every {r.checkPeriod}</span>}
            </div>
          </div>
        )}
        renderForm={(item) => (
          <>
            <Input
              name="action"
              label="Action"
              defaultValue={item?.action ?? "accept"}
              placeholder="accept or check"
            />
            <Input
              name="src"
              label="Sources"
              required
              defaultValue={item ? join(item.src) : ""}
              placeholder="group:admin, user1"
            />
            <Input
              name="dst"
              label="Destinations"
              required
              defaultValue={item ? join(item.dst) : ""}
              placeholder="tag:server"
            />
            <Input
              name="users"
              label="Users"
              required
              defaultValue={item ? join(item.users) : ""}
              placeholder="root, ubuntu"
            />
            <Input
              name="checkPeriod"
              label="Check Period"
              defaultValue={item?.checkPeriod ?? ""}
              placeholder="12h, 24h (optional)"
            />
          </>
        )}
        parseForm={(fd) => ({
          action:
            (fd.get("action") as string) === "check" ? ("check" as const) : ("accept" as const),
          src: split(fd.get("src") as string),
          dst: split(fd.get("dst") as string),
          users: split(fd.get("users") as string),
          ...((fd.get("checkPeriod") as string)?.trim()
            ? { checkPeriod: (fd.get("checkPeriod") as string).trim() }
            : {}),
        })}
        onAdd={(rule) => emit(addSshRule(policy, rule))}
        onUpdate={(i, rule) => emit(updateSshRule(policy, i, rule))}
        onRemove={(i) => emit(removeSshRule(policy, i))}
      />

      <RecordSection<string[]>
        title="Auto Approve Routes"
        emptyText="No auto-approved routes defined"
        disabled={disabled}
        entries={Object.entries(policy.autoApprovers?.routes ?? {})}
        renderRow={(cidr, approvers) => <KeyListRow label={cidr} values={approvers} />}
        renderForm={(key, approvers) => (
          <>
            <Input
              name="cidr"
              label="Route (CIDR)"
              required
              defaultValue={key ?? ""}
              placeholder="10.0.0.0/8, 192.168.1.0/24"
            />
            <Input
              name="approvers"
              label="Approvers"
              required
              defaultValue={approvers ? join(approvers) : ""}
              placeholder="group:admin, tag:server"
            />
          </>
        )}
        parseForm={(fd) => ({
          key: (fd.get("cidr") as string).trim(),
          value: split(fd.get("approvers") as string),
        })}
        onSet={(cidr, approvers) => emit(setAutoApproveRoute(policy, cidr, approvers))}
        onRename={(oldCidr, newCidr, approvers) =>
          emit(setAutoApproveRoute(removeAutoApproveRoute(policy, oldCidr), newCidr, approvers))
        }
        onRemove={(cidr) => emit(removeAutoApproveRoute(policy, cidr))}
      />

      <RecordSection<string[]>
        title="Auto Approve Exit Nodes"
        emptyText="No exit node auto-approvers defined"
        disabled={disabled}
        entries={
          policy.autoApprovers?.exitNode ? [["exitNode", policy.autoApprovers.exitNode]] : []
        }
        renderRow={(_key, approvers) => <Tags values={approvers} />}
        renderForm={(_key, approvers) => (
          <Input
            name="approvers"
            label="Approvers"
            required
            defaultValue={approvers ? join(approvers) : ""}
            placeholder="group:admin, tag:server"
          />
        )}
        parseForm={(fd) => ({
          key: "exitNode",
          value: split(fd.get("approvers") as string),
        })}
        onSet={(_key, approvers) => emit(setAutoApproveExitNode(policy, approvers))}
        onRename={(_old, _new, approvers) => emit(setAutoApproveExitNode(policy, approvers))}
        onRemove={() => emit(removeAutoApproveExitNode(policy))}
      />

      <ArraySection<AclTest>
        title="ACL Tests"
        emptyText="No ACL tests defined"
        disabled={disabled}
        items={policy.tests ?? []}
        renderRow={(t) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">from</span>
              <Chip text={t.src} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {t.accept && t.accept.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-green-600 dark:text-green-400">accept</span>
                  <Tags values={t.accept} />
                </span>
              )}
              {t.deny && t.deny.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-red-600 dark:text-red-400">deny</span>
                  <Tags values={t.deny} />
                </span>
              )}
            </div>
          </div>
        )}
        renderForm={(item) => (
          <>
            <Input
              name="src"
              label="Source"
              required
              defaultValue={item?.src ?? ""}
              placeholder="user1, group:admin"
            />
            <Input
              name="accept"
              label="Accept destinations"
              defaultValue={item?.accept ? join(item.accept) : ""}
              placeholder="100.64.0.1:80, server1:443"
            />
            <Input
              name="deny"
              label="Deny destinations"
              defaultValue={item?.deny ? join(item.deny) : ""}
              placeholder="100.64.0.2:22"
            />
          </>
        )}
        parseForm={(fd) => {
          const accept = split(fd.get("accept") as string);
          const deny = split(fd.get("deny") as string);
          return {
            src: (fd.get("src") as string).trim(),
            ...(accept.length > 0 ? { accept } : {}),
            ...(deny.length > 0 ? { deny } : {}),
          };
        }}
        onAdd={(test) => emit(addAclTest(policy, test))}
        onUpdate={(i, test) => emit(updateAclTest(policy, i, test))}
        onRemove={(i) => emit(removeAclTest(policy, i))}
      />
    </div>
  );
}
