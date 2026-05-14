import { assign, parse, stringify } from "comment-json";

export interface AclRule {
  action: "accept";
  src: string[];
  dst: string[];
  proto?: string;
}

export interface SshRule {
  action: "accept" | "check";
  src: string[];
  dst: string[];
  users: string[];
  checkPeriod?: string;
}

export interface AclPolicy {
  acls?: AclRule[];
  groups?: Record<string, string[]>;
  hosts?: Record<string, string>;
  tagOwners?: Record<string, string[]>;
  ssh?: SshRule[];
  autoApprovers?: { routes?: Record<string, string[]>; exitNode?: string[] };
  tests?: unknown[];
}

export function parsePolicy(raw: string): AclPolicy {
  if (!raw.trim()) return {};
  return parse(raw) as AclPolicy;
}

export function stringifyPolicy(policy: AclPolicy): string {
  return stringify(policy, null, 2);
}

// comment-json stores comments as Symbols which get lost in spread.
function patch(policy: AclPolicy, changes: Partial<AclPolicy>): AclPolicy {
  return assign(assign({} as AclPolicy, policy), changes) as AclPolicy;
}

// Generic array operations on a policy field
type ArrayField = "acls" | "ssh";

function appendTo<K extends ArrayField>(
  policy: AclPolicy,
  key: K,
  item: NonNullable<AclPolicy[K]>[number],
): AclPolicy {
  return patch(policy, {
    [key]: [...((policy[key] as unknown[]) ?? []), item],
  } as Partial<AclPolicy>);
}

function removeAt<K extends ArrayField>(policy: AclPolicy, key: K, index: number): AclPolicy {
  const arr = [...((policy[key] as unknown[]) ?? [])];
  if (index < 0 || index >= arr.length) return policy;
  arr.splice(index, 1);
  return patch(policy, { [key]: arr } as Partial<AclPolicy>);
}

function replaceAt<K extends ArrayField>(
  policy: AclPolicy,
  key: K,
  index: number,
  item: NonNullable<AclPolicy[K]>[number],
): AclPolicy {
  const arr = [...((policy[key] as unknown[]) ?? [])];
  if (index < 0 || index >= arr.length) return policy;
  arr[index] = item;
  return patch(policy, { [key]: arr } as Partial<AclPolicy>);
}

// Generic record operations on a policy field
type RecordField = "groups" | "hosts" | "tagOwners";

function setEntry<K extends RecordField>(
  policy: AclPolicy,
  key: K,
  entryKey: string,
  value: NonNullable<AclPolicy[K]>[string],
): AclPolicy {
  return patch(policy, {
    [key]: { ...(policy[key] as Record<string, unknown>), [entryKey]: value },
  } as Partial<AclPolicy>);
}

function removeEntry<K extends RecordField>(
  policy: AclPolicy,
  key: K,
  entryKey: string,
): AclPolicy {
  const map = { ...(policy[key] as Record<string, unknown>) };
  delete map[entryKey];
  return patch(policy, { [key]: map } as Partial<AclPolicy>);
}

// Prefix helpers
function groupKey(name: string) {
  return name.startsWith("group:") ? name : `group:${name}`;
}

function tagKey(name: string) {
  return name.startsWith("tag:") ? name : `tag:${name}`;
}

// ACL rules
export const addAclRule = (p: AclPolicy, rule: AclRule) => appendTo(p, "acls", rule);
export const removeAclRule = (p: AclPolicy, i: number) => removeAt(p, "acls", i);
export const updateAclRule = (p: AclPolicy, i: number, rule: AclRule) =>
  replaceAt(p, "acls", i, rule);

// SSH rules
export const addSshRule = (p: AclPolicy, rule: SshRule) => appendTo(p, "ssh", rule);
export const removeSshRule = (p: AclPolicy, i: number) => removeAt(p, "ssh", i);
export const updateSshRule = (p: AclPolicy, i: number, rule: SshRule) =>
  replaceAt(p, "ssh", i, rule);

// Groups
export const setGroup = (p: AclPolicy, name: string, members: string[]) =>
  setEntry(p, "groups", groupKey(name), members);
export const removeGroup = (p: AclPolicy, name: string) => removeEntry(p, "groups", groupKey(name));

// Hosts
export const setHost = (p: AclPolicy, name: string, addr: string) =>
  setEntry(p, "hosts", name, addr);
export const removeHost = (p: AclPolicy, name: string) => removeEntry(p, "hosts", name);

// Tag owners
export const setTagOwner = (p: AclPolicy, tag: string, owners: string[]) =>
  setEntry(p, "tagOwners", tagKey(tag), owners);
export const removeTagOwner = (p: AclPolicy, tag: string) =>
  removeEntry(p, "tagOwners", tagKey(tag));
