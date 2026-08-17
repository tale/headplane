import { stripJsonCommentsAndTrailingCommas } from "~/utils/node-info";

// A structured view over the Headscale ACL policy (HuJSON). Headscale stores
// the policy as an opaque string, so the visual editor parses it into this
// model, mutates it, and serializes it back. Unknown top-level keys are kept
// in `extra` so editing a policy never drops fields Headplane doesn't know.

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

export interface Policy {
  groups: Record<string, string[]>;
  tagOwners: Record<string, string[]>;
  hosts: Record<string, string>;
  acls: AclRule[];
  ssh: SshRule[];
  // Top-level keys Headplane does not model (autoApprovers, nodeAttrs, ...)
  extra: Record<string, unknown>;
}

export type ParseResult =
  | { ok: true; policy: Policy; hasComments: boolean }
  | { ok: false; error: string };

export const EMPTY_POLICY: Policy = {
  groups: {},
  tagOwners: {},
  hosts: {},
  acls: [],
  ssh: [],
  extra: {},
};

const KNOWN_KEYS = ["groups", "tagOwners", "hosts", "acls", "ssh"];

export function parsePolicy(raw: string): ParseResult {
  if (raw.trim().length === 0) {
    return { ok: true, policy: structuredClone(EMPTY_POLICY), hasComments: false };
  }

  const stripped = stripJsonCommentsAndTrailingCommas(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The policy is not valid HuJSON",
    };
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "The policy must be a JSON object" };
  }

  const record = parsed as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_KEYS.includes(key)) {
      extra[key] = value;
    }
  }

  return {
    ok: true,
    hasComments: stripped.length !== raw.length,
    policy: {
      groups: toStringListMap(record.groups),
      tagOwners: toStringListMap(record.tagOwners),
      hosts: toStringMap(record.hosts),
      acls: toAclRules(record.acls),
      ssh: toSshRules(record.ssh),
      extra,
    },
  };
}

export function serializePolicy(policy: Policy): string {
  const out: Record<string, unknown> = {};

  // Insertion order is preserved so editing one entry doesn't reshuffle a
  // policy the operator wrote by hand.
  if (Object.keys(policy.groups).length > 0) out.groups = policy.groups;
  if (Object.keys(policy.tagOwners).length > 0) out.tagOwners = policy.tagOwners;
  if (Object.keys(policy.hosts).length > 0) out.hosts = policy.hosts;
  if (policy.acls.length > 0) out.acls = policy.acls.map(compactAclRule);
  if (policy.ssh.length > 0) out.ssh = policy.ssh.map(compactSshRule);
  for (const [key, value] of Object.entries(policy.extra)) {
    out[key] = value;
  }

  return `${format(out, 0)}\n`;
}

// MARK: Catalog helpers

// Everything that can be used as a source in an ACL rule.
export function policySources(policy: Policy, users: string[]): string[] {
  return unique([
    "*",
    "autogroup:member",
    "autogroup:admin",
    ...Object.keys(policy.groups),
    ...Object.keys(policy.tagOwners),
    ...Object.keys(policy.hosts),
    ...users.map(asUserReference),
  ]);
}

// Everything that can be used as a destination in an ACL rule. Ports are
// appended by the rule editor, so the raw identities are returned here.
export function policyDestinations(policy: Policy, users: string[]): string[] {
  return unique([
    "*",
    "autogroup:internet",
    "autogroup:self",
    ...Object.keys(policy.groups),
    ...Object.keys(policy.tagOwners),
    ...Object.keys(policy.hosts),
    ...users.map(asUserReference),
  ]);
}

// Headscale references users as "name@" in policies.
export function asUserReference(user: string): string {
  return user.endsWith("@") ? user : `${user}@`;
}

// A port spec is the trailing `:...` of a destination: `*`, a single port, a
// range, or a comma separated list of either.
const PORT_SPEC = /:(\*|\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*)$/;

// Whether a destination already carries a port spec. Bare IPv6 addresses are
// never treated as ported: `fd7a::1` ends in something that looks like a port,
// so a port on an IPv6 destination has to be written as `[fd7a::1]:22`.
export function hasPortSpec(destination: string): boolean {
  if (destination.includes("::") && !destination.includes("]")) {
    return false;
  }

  return PORT_SPEC.test(destination);
}

// ACL destinations must specify ports; Headscale rejects the rule otherwise.
// Anything typed or picked without one gets `:*`, which is what people mean.
export function withDefaultPort(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.length === 0 || hasPortSpec(trimmed)) {
    return trimmed;
  }

  return `${trimmed}:*`;
}

// The groups a given Headscale user belongs to.
export function groupsForUser(policy: Policy, userName: string): string[] {
  const reference = asUserReference(userName);
  return Object.entries(policy.groups)
    .filter(([, members]) => members.includes(reference) || members.includes(userName))
    .map(([group]) => group)
    .sort();
}

// Replaces the full group membership of a user in one pass.
export function setUserGroups(policy: Policy, userName: string, groups: string[]): Policy {
  const reference = asUserReference(userName);
  const next: Record<string, string[]> = {};

  for (const [group, members] of Object.entries(policy.groups)) {
    const isMember = members.includes(reference) || members.includes(userName);
    const shouldBeMember = groups.includes(group);

    if (isMember === shouldBeMember) {
      // Leave the member list untouched so the policy diff stays minimal.
      next[group] = members;
      continue;
    }

    next[group] = shouldBeMember
      ? [...members, reference]
      : members.filter((member) => member !== reference && member !== userName);
  }

  // Groups that don't exist yet are created with this user as the only member.
  for (const group of groups) {
    if (!(group in next)) {
      next[group] = [reference];
    }
  }

  return { ...policy, groups: next };
}

// MARK: Validation

export function isValidGroupName(name: string): boolean {
  return /^group:[a-z0-9][a-z0-9-]*$/.test(name);
}

export function isValidTagName(name: string): boolean {
  return /^tag:[a-z0-9][a-z0-9-]*$/.test(name);
}

export function isValidHostName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

// MARK: Internals

function toStringListMap(value: unknown): Record<string, string[]> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = toStringList(entry);
  }
  return out;
}

function toStringMap(value: unknown): Record<string, string> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toAclRules(value: unknown): AclRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === "object")
    .map((entry) => {
      const rule: AclRule = {
        action: "accept",
        src: toStringList(entry.src),
        dst: toStringList(entry.dst),
      };
      if (typeof entry.proto === "string" && entry.proto.length > 0) {
        rule.proto = entry.proto;
      }
      return rule;
    });
}

function toSshRules(value: unknown): SshRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === "object")
    .map((entry) => {
      const rule: SshRule = {
        action: entry.action === "check" ? "check" : "accept",
        src: toStringList(entry.src),
        dst: toStringList(entry.dst),
        users: toStringList(entry.users),
      };
      if (typeof entry.checkPeriod === "string" && entry.checkPeriod.length > 0) {
        rule.checkPeriod = entry.checkPeriod;
      }
      return rule;
    });
}

function compactAclRule(rule: AclRule): Record<string, unknown> {
  const out: Record<string, unknown> = { action: rule.action, src: rule.src, dst: rule.dst };
  if (rule.proto) out.proto = rule.proto;
  return out;
}

function compactSshRule(rule: SshRule): Record<string, unknown> {
  const out: Record<string, unknown> = {
    action: rule.action,
    src: rule.src,
    dst: rule.dst,
    users: rule.users,
  };
  if (rule.checkPeriod) out.checkPeriod = rule.checkPeriod;
  return out;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

// Rules wider than this are broken across multiple lines.
const INLINE_WIDTH = 120;

// A tiny pretty-printer that keeps arrays of primitives — and short rule
// objects — on a single line, which is how Tailscale and Headscale policy
// examples are formatted. Keeping the output close to hand-written policies
// means the diff view only shows what actually changed.
function format(value: unknown, depth: number, allowInline = false): string {
  const indent = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.every(isPrimitive)) {
      return `[${value.map((entry) => JSON.stringify(entry)).join(", ")}]`;
    }
    // Rules live inside arrays, and those are the objects worth inlining.
    const entries = value.map((entry) => `${inner}${format(entry, depth + 1, true)}`);
    return `[\n${entries.join(",\n")}\n${indent}]`;
  }

  if (value != null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }

    const inline = allowInline ? inlineObject(entries) : undefined;
    if (inline !== undefined && indent.length + inline.length <= INLINE_WIDTH) {
      return inline;
    }

    const body = entries.map(
      ([key, entry]) => `${inner}${JSON.stringify(key)}: ${format(entry, depth + 1)}`,
    );
    return `{\n${body.join(",\n")}\n${indent}}`;
  }

  return JSON.stringify(value);
}

// Renders an object on one line, but only when every value is a primitive or
// an array of primitives. Returns undefined when it must be expanded.
function inlineObject(entries: [string, unknown][]): string | undefined {
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (isPrimitive(value)) {
      parts.push(`${JSON.stringify(key)}: ${JSON.stringify(value)}`);
      continue;
    }
    if (Array.isArray(value) && value.every(isPrimitive)) {
      parts.push(
        `${JSON.stringify(key)}: [${value.map((entry) => JSON.stringify(entry)).join(", ")}]`,
      );
      continue;
    }
    return undefined;
  }

  return `{ ${parts.join(", ")} }`;
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== "object";
}
