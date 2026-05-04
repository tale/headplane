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

export interface AclTest {
  src: string;
  accept?: string[];
  deny?: string[];
}

export interface AclPolicy {
  acls?: AclRule[];
  groups?: Record<string, string[]>;
  hosts?: Record<string, string>;
  tagOwners?: Record<string, string[]>;
  ssh?: SshRule[];
  autoApprovers?: { routes?: Record<string, string[]>; exitNode?: string[] };
  tests?: AclTest[];
}

export function parsePolicy(raw: string): AclPolicy {
  if (!raw.trim()) return {};
  return parse(raw) as AclPolicy;
}

export function stringifyPolicy(policy: AclPolicy): string {
  return stringify(policy, null, 2);
}

function patch(policy: AclPolicy, changes: Partial<AclPolicy>): AclPolicy {
  return assign(assign({} as AclPolicy, policy), changes) as AclPolicy;
}

type ArrayField = "acls" | "ssh" | "tests";

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

export function groupKey(name: string) {
  return name.startsWith("group:") ? name : `group:${name}`;
}

export function tagKey(name: string) {
  return name.startsWith("tag:") ? name : `tag:${name}`;
}

export const addAclRule = (p: AclPolicy, rule: AclRule) => appendTo(p, "acls", rule);
export const removeAclRule = (p: AclPolicy, i: number) => removeAt(p, "acls", i);
export const updateAclRule = (p: AclPolicy, i: number, rule: AclRule) =>
  replaceAt(p, "acls", i, rule);

export const addSshRule = (p: AclPolicy, rule: SshRule) => appendTo(p, "ssh", rule);
export const removeSshRule = (p: AclPolicy, i: number) => removeAt(p, "ssh", i);
export const updateSshRule = (p: AclPolicy, i: number, rule: SshRule) =>
  replaceAt(p, "ssh", i, rule);

export const setGroup = (p: AclPolicy, name: string, members: string[]) =>
  setEntry(p, "groups", groupKey(name), members);
export const removeGroup = (p: AclPolicy, name: string) => removeEntry(p, "groups", groupKey(name));

export const setHost = (p: AclPolicy, name: string, addr: string) =>
  setEntry(p, "hosts", name, addr);
export const removeHost = (p: AclPolicy, name: string) => removeEntry(p, "hosts", name);

export const setTagOwner = (p: AclPolicy, tag: string, owners: string[]) =>
  setEntry(p, "tagOwners", tagKey(tag), owners);
export const removeTagOwner = (p: AclPolicy, tag: string) =>
  removeEntry(p, "tagOwners", tagKey(tag));

export const addAclTest = (p: AclPolicy, test: AclTest) => appendTo(p, "tests", test);
export const removeAclTest = (p: AclPolicy, i: number) => removeAt(p, "tests", i);
export const updateAclTest = (p: AclPolicy, i: number, test: AclTest) =>
  replaceAt(p, "tests", i, test);

export function setAutoApproveRoute(p: AclPolicy, cidr: string, approvers: string[]): AclPolicy {
  const current = p.autoApprovers ?? {};
  return patch(p, {
    autoApprovers: {
      ...current,
      routes: { ...current.routes, [cidr]: approvers },
    },
  });
}

export function removeAutoApproveRoute(p: AclPolicy, cidr: string): AclPolicy {
  const routes = { ...p.autoApprovers?.routes };
  delete routes[cidr];
  return patch(p, {
    autoApprovers: { ...p.autoApprovers, routes },
  });
}

export function setAutoApproveExitNode(p: AclPolicy, approvers: string[]): AclPolicy {
  return patch(p, {
    autoApprovers: { ...p.autoApprovers, exitNode: approvers },
  });
}

export function removeAutoApproveExitNode(p: AclPolicy): AclPolicy {
  const { exitNode: _, ...rest } = p.autoApprovers ?? {};
  return patch(p, { autoApprovers: rest });
}
