// HuJSON policy text -> typed AclPolicy.

import { stripHuJSON } from "~/utils/hujson";

import type { AclPolicy, AclRule, AclWarning, DstEntry, PortRange } from "./model";

export interface ParseResult {
  policy: AclPolicy;
  warnings: AclWarning[];
}

const FULL_RANGE: PortRange = { start: 0, end: 65535 };
const PORT_SPEC = /^(\d+)(-(\d+))?(,(\d+)(-(\d+))?)*$/;

export function parsePolicy(policyText: string): ParseResult {
  const warnings: AclWarning[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(stripHuJSON(policyText));
  } catch (e) {
    return {
      policy: { groups: {}, tagOwners: {}, hosts: {}, acls: [] },
      warnings: [{ message: `Failed to parse policy: ${(e as Error).message}` }],
    };
  }

  const root = isRecord(raw) ? raw : {};
  const acls: AclRule[] = [];
  const rawAcls = Array.isArray(root.acls) ? root.acls : [];

  rawAcls.forEach((r, index) => {
    if (!isRecord(r)) {
      warnings.push({ message: `acls[${index}] is not an object; skipped`, ruleIndex: index });
      return;
    }
    if (r.action !== "accept") {
      warnings.push({
        message: `acls[${index}] action "${String(r.action)}" is not "accept"; skipped`,
        ruleIndex: index,
      });
      return;
    }
    const src = Array.isArray(r.src) ? r.src.map(String) : [];
    const dst = (Array.isArray(r.dst) ? r.dst.map(String) : []).map((d) =>
      parseDst(d, warnings, index),
    );
    acls.push({
      index,
      action: "accept",
      src,
      dst,
      proto: typeof r.proto === "string" ? r.proto : undefined,
    });
  });

  return {
    policy: {
      groups: asStringArrayRecord(root.groups),
      tagOwners: asStringArrayRecord(root.tagOwners),
      hosts: asStringRecord(root.hosts),
      acls,
    },
    warnings,
  };
}

/**
 * Split one dst token into alias + ports. Splits on the LAST ":" whose suffix
 * is a valid port spec — aliases (tag:/group:/autogroup:) and IPv6 CIDRs are
 * full of colons, so first-colon splitting would corrupt them.
 */
export function parseDst(raw: string, warnings?: AclWarning[], ruleIndex?: number): DstEntry {
  const idx = raw.lastIndexOf(":");
  const spec = idx === -1 ? "" : raw.slice(idx + 1);
  if (idx === -1 || !isPortSpec(spec)) {
    warnings?.push({
      message: `dst "${raw}"${ruleIndex != null ? ` in acls[${ruleIndex}]` : ""} has no valid port spec; defaulting to *`,
      ruleIndex,
      token: raw,
    });
    return { alias: raw, ports: [FULL_RANGE], raw };
  }
  return { alias: raw.slice(0, idx), ports: parsePorts(spec), raw };
}

export function parsePorts(spec: string): PortRange[] {
  if (spec === "*") return [FULL_RANGE];
  return spec.split(",").map((part) => {
    const [a, b] = part.split("-");
    const start = Number(a);
    return { start, end: b !== undefined ? Number(b) : start };
  });
}

function isPortSpec(spec: string): boolean {
  return spec === "*" || PORT_SPEC.test(spec);
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function asStringRecord(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return out;
}

function asStringArrayRecord(v: unknown): Record<string, string[]> {
  if (!isRecord(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v)) if (Array.isArray(val)) out[k] = val.map(String);
  return out;
}
