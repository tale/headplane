import {
  applyEdits,
  format as formatJson,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type ParseError,
} from "jsonc-parser";

import { scanHuJson } from "~/utils/node-info";

// A structured view over the Headscale ACL policy (HuJSON), which Headscale
// stores as an opaque string. What Headplane does not model is kept in `extra`.

// `action` is kept verbatim: rewriting an unknown action into `accept` would
// turn a rule we do not understand into one that allows traffic.
export interface AclRule {
  action: string;
  src: string[];
  dst: string[];
  proto?: string;
  extra: Record<string, unknown>;
}

export interface SshRule {
  action: string;
  src: string[];
  dst: string[];
  users: string[];
  checkPeriod?: string;
  extra: Record<string, unknown>;
}

// The SSH actions the editor offers; anything else is kept and shown as-is.
export const KNOWN_SSH_ACTIONS = ["accept", "check"];

export interface Policy {
  groups: Record<string, string[]>;
  tagOwners: Record<string, string[]>;
  hosts: Record<string, string>;
  acls: AclRule[];
  ssh: SshRule[];
  // Top-level keys Headplane does not model (autoApprovers, nodeAttrs, ...)
  extra: Record<string, unknown>;
  // The order the top-level keys appeared in, so serializing keeps it.
  keyOrder: string[];
}

export type ParseResult =
  | { ok: true; policy: Policy; hasComments: boolean }
  | { ok: false; error: string };

export type FormatResult = { ok: true; value: string } | { ok: false; error: string };

export interface PolicyDiagnostic {
  from: number;
  to: number;
  message: string;
}

export const EMPTY_POLICY: Policy = {
  groups: {},
  tagOwners: {},
  hosts: {},
  acls: [],
  ssh: [],
  extra: {},
  keyOrder: [],
};

const KNOWN_KEYS = ["groups", "tagOwners", "hosts", "acls", "ssh"];

export function parsePolicy(raw: string): ParseResult {
  if (raw.trim().length === 0) {
    return { ok: true, policy: structuredClone(EMPTY_POLICY), hasComments: false };
  }

  const result = parseHuJson(raw);
  if (!result.ok) return result;

  const { parsed, hasComments } = result;

  const record = parsed;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_KEYS.includes(key)) {
      extra[key] = value;
    }
  }

  return {
    ok: true,
    hasComments,
    policy: {
      groups: toStringListMap(record.groups),
      tagOwners: toStringListMap(record.tagOwners),
      hosts: toStringMap(record.hosts),
      acls: toAclRules(record.acls),
      ssh: toSshRules(record.ssh),
      extra,
      keyOrder: Object.keys(record),
    },
  };
}

export function formatPolicy(raw: string): FormatResult {
  if (raw.trim().length === 0) {
    return { ok: false, error: "The policy is empty" };
  }

  const result = parseHuJson(raw);
  if (!result.ok) return result;

  // Line breaks are kept: a hand-written policy groups rules with blank lines
  // and keeps short arrays inline, and reflowing would throw both away.
  const edits = formatJson(raw, undefined, {
    eol: "\n",
    insertFinalNewline: true,
    insertSpaces: true,
    keepLines: true,
    tabSize: 2,
  });
  return { ok: true, value: applyEdits(raw, edits) };
}

type HuJsonResult =
  | { ok: true; parsed: Record<string, unknown>; hasComments: boolean }
  | { ok: false; error: string };

function parseHuJson(raw: string): HuJsonResult {
  const errors: ParseError[] = [];
  const tree = parseTree(raw, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const first = errors[0];
    return {
      ok: false,
      error: withLocation(raw, humanizeParseError(first), first.offset),
    };
  }

  if (tree?.type !== "object") {
    return { ok: false, error: "The policy must be a JSON object" };
  }

  return {
    ok: true,
    parsed: getNodeValue(tree) as Record<string, unknown>,
    hasComments: scanHuJson(raw).hasComments,
  };
}

// An empty policy is not a syntax error; like `parsePolicy`, it is treated as
// the "no policy yet" state and the caller decides what that means.
export function validatePolicy(raw: string): PolicyDiagnostic[] {
  if (raw.trim().length === 0) {
    return [];
  }

  const errors: ParseError[] = [];
  const tree = parseTree(raw, errors, { allowTrailingComma: true });
  const diagnostics = errors.map((error) => ({
    from: error.offset,
    to: Math.min(raw.length, error.offset + Math.max(1, error.length)),
    message: humanizeParseError(error),
  }));

  if (diagnostics.length === 0 && tree?.type !== "object") {
    diagnostics.push({
      from: 0,
      to: raw.length,
      message: "The policy must be a JSON object",
    });
  }

  return diagnostics;
}

function humanizeParseError(error: ParseError): string {
  return printParseErrorCode(error.error).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function withLocation(raw: string, message: string, offset: number): string {
  const before = raw.slice(0, offset);
  const line = before.split(/\r\n|\r|\n/).length;
  const lastLineBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
  const column = offset - lastLineBreak;
  return `${message} at line ${line}, column ${column}`;
}

export function serializePolicy(policy: Policy): string {
  const sections: Record<string, unknown> = {};

  // Insertion order is preserved so an edit does not reshuffle the rest.
  if (Object.keys(policy.groups).length > 0) sections.groups = policy.groups;
  if (Object.keys(policy.tagOwners).length > 0) sections.tagOwners = policy.tagOwners;
  if (Object.keys(policy.hosts).length > 0) sections.hosts = policy.hosts;
  if (policy.acls.length > 0) sections.acls = policy.acls.map(compactAclRule);
  if (policy.ssh.length > 0) sections.ssh = policy.ssh.map(compactSshRule);
  for (const [key, value] of Object.entries(policy.extra)) {
    sections[key] = value;
  }

  const out: Record<string, unknown> = {};
  for (const key of policy.keyOrder) {
    if (key in sections) {
      out[key] = sections[key];
    }
  }
  // Sections that did not exist before are appended.
  for (const [key, value] of Object.entries(sections)) {
    if (!(key in out)) {
      out[key] = value;
    }
  }

  return `${format(out, 0)}\n`;
}

// MARK: Catalog helpers

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

// Destinations without their port spec; the rule editor appends it.
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

// `*`, a single port, a range, or a comma separated list of either.
const PORT_SPEC = /^(\*|\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*)$/;

// Headscale splits a destination on its *last* colon, so `fd7a::1:22` is
// `fd7a::1` on port 22. The tail only counts as a port when what precedes it is
// a destination in its own right, which keeps `fd7a::1` (head `fd7a:`) intact.
export function hasPortSpec(destination: string): boolean {
  const lastColon = destination.lastIndexOf(":");
  if (lastColon <= 0 || lastColon === destination.length - 1) {
    return false;
  }

  if (!PORT_SPEC.test(destination.slice(lastColon + 1))) {
    return false;
  }

  return isCompleteDestination(destination.slice(0, lastColon));
}

const ALIAS_PREFIXES = ["tag:", "group:", "autogroup:"];

// Only a prefixed alias or an IPv6 address carries an inner colon.
function isCompleteDestination(value: string): boolean {
  if (value.length === 0 || value.endsWith(":")) {
    return false;
  }

  if (ALIAS_PREFIXES.some((prefix) => value.startsWith(prefix)) || !value.includes(":")) {
    return true;
  }

  // Headscale does not accept the bracketed form, but a hand-written policy
  // may use it and appending a port would only make it worse.
  if (value.startsWith("[") && value.endsWith("]")) {
    return isIpv6(value.slice(1, -1));
  }

  return isIpv6(value);
}

const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// Enough to tell an address or prefix apart from an alias, not a validator.
function isIpv6(value: string): boolean {
  const [address, prefixLength, ...rest] = value.split("/");
  if (rest.length > 0 || (prefixLength !== undefined && !/^\d{1,3}$/.test(prefixLength))) {
    return false;
  }

  const halves = address.split("::");
  if (halves.length > 2) {
    return false;
  }

  const groups = halves.flatMap((half) => (half.length === 0 ? [] : half.split(":")));
  if (groups.length === 0) {
    // The unspecified address, `::`.
    return halves.length === 2;
  }

  const last = groups[groups.length - 1];
  const head = IPV4.test(last) ? groups.slice(0, -1) : groups;
  if (!head.every((group) => IPV6_GROUP.test(group))) {
    return false;
  }

  // An embedded IPv4 tail fills the last two groups.
  const width = IPV4.test(last) ? head.length + 2 : groups.length;
  return halves.length === 2 ? width <= 7 : width === 8;
}

// Headscale rejects a destination without a port, so one gets `:*`.
export function withDefaultPort(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.length === 0 || hasPortSpec(trimmed)) {
    return trimmed;
  }

  return `${trimmed}:*`;
}

export function groupsForUser(policy: Policy, userName: string): string[] {
  const reference = asUserReference(userName);
  return Object.entries(policy.groups)
    .filter(([, members]) => members.includes(reference) || members.includes(userName))
    .map(([group]) => group)
    .sort();
}

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

const ACL_RULE_KEYS = ["action", "src", "dst", "proto"];
const SSH_RULE_KEYS = ["action", "src", "dst", "users", "checkPeriod"];

function toAclRules(value: unknown): AclRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === "object")
    .map((entry) => {
      const rule: AclRule = {
        action: typeof entry.action === "string" ? entry.action : "accept",
        src: toStringList(entry.src),
        dst: toStringList(entry.dst),
        extra: extraKeys(entry, ACL_RULE_KEYS),
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
        action: typeof entry.action === "string" ? entry.action : "accept",
        src: toStringList(entry.src),
        dst: toStringList(entry.dst),
        users: toStringList(entry.users),
        extra: extraKeys(entry, SSH_RULE_KEYS),
      };
      if (typeof entry.checkPeriod === "string" && entry.checkPeriod.length > 0) {
        rule.checkPeriod = entry.checkPeriod;
      }
      return rule;
    });
}

// Fields with no editor — `srcPosture`, `acceptEnv` — ride along untouched.
function extraKeys(entry: Record<string, unknown>, known: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!known.includes(key)) {
      out[key] = value;
    }
  }
  return out;
}

function compactAclRule(rule: AclRule): Record<string, unknown> {
  const out: Record<string, unknown> = { action: rule.action, src: rule.src, dst: rule.dst };
  if (rule.proto) out.proto = rule.proto;
  return { ...out, ...rule.extra };
}

function compactSshRule(rule: SshRule): Record<string, unknown> {
  const out: Record<string, unknown> = {
    action: rule.action,
    src: rule.src,
    dst: rule.dst,
    users: rule.users,
  };
  if (rule.checkPeriod) out.checkPeriod = rule.checkPeriod;
  return { ...out, ...rule.extra };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

// Rules wider than this are broken across multiple lines.
const INLINE_WIDTH = 120;

// Keeps arrays of primitives, and short rule objects, on one line, the way
// Tailscale and Headscale policy examples are written.
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

// Returns undefined when the object has to be expanded.
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
