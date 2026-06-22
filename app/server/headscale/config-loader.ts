import { constants, access, readFile, writeFile } from "node:fs/promises";
import { exit } from "node:process";

import * as v from "valibot";
import { Document, parseDocument } from "yaml";

import log from "~/utils/log";

import { DNSRecord, HeadscaleDNSConfig, loadHeadscaleDNS } from "./config-dns";

interface PatchConfig {
  path: string;
  value: unknown;
}

interface DNSConfigView {
  magicDns: boolean;
  baseDomain: string;
  nameservers: string[];
  splitDns: Record<string, string[]>;
  searchDomains: string[];
  overrideDns: boolean;
  extraRecords: DNSRecord[];
}

interface OIDCConfigView {
  issuer: string;
  allowedDomains: string[];
  allowedGroups: string[];
  allowedUsers: string[];
}

interface ParsedDNSConfig {
  magic_dns: boolean;
  base_domain: string;
  nameservers: {
    global: string[];
    split: Record<string, string[]>;
  };
  search_domains: string[];
  override_local_dns: boolean;
  extra_records: DNSRecord[];
  extra_records_path?: string;
}

const DNS_CONFIG_DEFAULTS: ParsedDNSConfig = {
  magic_dns: true,
  base_domain: "",
  nameservers: {
    global: [],
    split: {},
  },
  search_domains: [],
  override_local_dns: true,
  extra_records: [],
};

const stringSchema = v.string();
const stringArraySchema = v.array(v.string());
const stringArrayRecordSchema = v.record(v.string(), stringArraySchema);
const goBooleanSchema = v.pipe(
  v.union([v.boolean(), v.picklist(["true", "false"])]),
  v.transform((value) => value === true || value === "true"),
);
const dnsRecordsSchema = v.array(
  v.object({
    name: v.string(),
    type: v.string(),
    value: v.string(),
  }),
);
const nameserversSchema = v.object({
  global: v.optional(v.fallback(stringArraySchema, []), []),
  split: v.optional(v.fallback(stringArrayRecordSchema, {}), {}),
});
const dnsConfigSchema = v.object({
  magic_dns: v.optional(
    v.fallback(goBooleanSchema, DNS_CONFIG_DEFAULTS.magic_dns),
    DNS_CONFIG_DEFAULTS.magic_dns,
  ),
  base_domain: v.optional(
    v.fallback(stringSchema, DNS_CONFIG_DEFAULTS.base_domain),
    DNS_CONFIG_DEFAULTS.base_domain,
  ),
  nameservers: v.optional(
    v.fallback(nameserversSchema, DNS_CONFIG_DEFAULTS.nameservers),
    DNS_CONFIG_DEFAULTS.nameservers,
  ),
  search_domains: v.optional(
    v.fallback(stringArraySchema, DNS_CONFIG_DEFAULTS.search_domains),
    DNS_CONFIG_DEFAULTS.search_domains,
  ),
  override_local_dns: v.optional(
    v.fallback(goBooleanSchema, DNS_CONFIG_DEFAULTS.override_local_dns),
    DNS_CONFIG_DEFAULTS.override_local_dns,
  ),
  extra_records: v.optional(
    v.fallback(dnsRecordsSchema, DNS_CONFIG_DEFAULTS.extra_records),
    DNS_CONFIG_DEFAULTS.extra_records,
  ),
  extra_records_path: v.optional(v.string()),
});
const headscaleConfigSchema = v.fallback(
  v.object({
    dns: v.optional(v.fallback(dnsConfigSchema, DNS_CONFIG_DEFAULTS), DNS_CONFIG_DEFAULTS),
  }),
  { dns: DNS_CONFIG_DEFAULTS },
);
const oidcConfigSchema = v.object({
  issuer: v.string(),
  allowed_domains: v.optional(v.fallback(stringArraySchema, []), []),
  allowed_groups: v.optional(v.fallback(stringArraySchema, []), []),
  allowed_users: v.optional(v.fallback(stringArraySchema, []), []),
});
const rawOIDCConfigSchema = v.fallback(
  v.object({
    oidc: v.optional(v.unknown()),
  }),
  {},
);
const extraRecordsConflictSchema = v.object({
  dns: v.optional(
    v.object({
      extra_records: v.optional(v.array(v.unknown())),
      extra_records_path: v.optional(v.string()),
    }),
  ),
});

interface HeadscaleConfigState {
  document?: Document;
  config: unknown;
  access: "rw" | "ro" | "no";
  path?: string;
  writeQueue: Promise<void>;
  dns?: HeadscaleDNSConfig;
}

interface HeadscaleConfig {
  readable: () => boolean;
  writable: () => boolean;
  getDNSConfig: () => DNSConfigView;
  getMagicDNSBaseDomain: () => string | undefined;
  getOIDCConfig: () => OIDCConfigView | undefined;
  hasOIDCConfig: () => boolean;
  dnsRecords: () => DNSRecord[];
  patch: (patches: PatchConfig[]) => Promise<void>;
  addDNS: (record: DNSRecord) => Promise<boolean | void>;
  removeDNS: (record: DNSRecord) => Promise<boolean | void>;
}

function createHeadscaleConfig(
  access: "rw" | "ro" | "no",
  dns?: HeadscaleDNSConfig,
  document?: Document,
  path?: string,
): HeadscaleConfig {
  const state: HeadscaleConfigState = {
    access,
    config: document?.toJSON() ?? {},
    document,
    path,
    writeQueue: Promise.resolve(),
    dns,
  };

  return {
    readable: () => readable(state),
    writable: () => writable(state),
    getDNSConfig: () => getDNSConfig(state),
    getMagicDNSBaseDomain: () => getMagicDNSBaseDomain(state),
    getOIDCConfig: () => getOIDCConfig(state),
    hasOIDCConfig: () => hasOIDCConfig(state),
    dnsRecords: () => dnsRecords(state),
    patch: (patches) => patchHeadscaleConfig(state, patches),
    addDNS: (record) => addDNS(state, record),
    removeDNS: (record) => removeDNS(state, record),
  };
}

function readable(config: HeadscaleConfigState) {
  return config.access !== "no";
}

function writable(config: HeadscaleConfigState) {
  return config.access === "rw";
}

function getDNSConfig(config: HeadscaleConfigState): DNSConfigView {
  const dns = v.parse(headscaleConfigSchema, config.config).dns;

  return {
    magicDns: dns.magic_dns,
    baseDomain: dns.base_domain,
    nameservers: dns.nameservers.global,
    splitDns: dns.nameservers.split ?? {},
    searchDomains: dns.search_domains,
    overrideDns: dns.override_local_dns,
    extraRecords: dnsRecords(config),
  };
}

function getMagicDNSBaseDomain(config: HeadscaleConfigState) {
  if (!readable(config)) return;
  const dns = getDNSConfig(config);
  return dns.magicDns && dns.baseDomain ? dns.baseDomain : undefined;
}

function getOIDCConfig(config: HeadscaleConfigState): OIDCConfigView | undefined {
  const oidc = v.safeParse(oidcConfigSchema, v.parse(rawOIDCConfigSchema, config.config).oidc);
  if (!oidc.success) return;

  return {
    issuer: oidc.output.issuer,
    allowedDomains: oidc.output.allowed_domains,
    allowedGroups: oidc.output.allowed_groups,
    allowedUsers: oidc.output.allowed_users,
  };
}

function hasOIDCConfig(config: HeadscaleConfigState) {
  return getOIDCConfig(config) !== undefined;
}

function dnsRecords(config: HeadscaleConfigState) {
  if (config.dns) {
    return config.dns.r;
  }

  return v.parse(headscaleConfigSchema, config.config).dns.extra_records;
}

async function patchHeadscaleConfig(config: HeadscaleConfigState, patches: PatchConfig[]) {
  if (!config.path || !config.document || !readable(config) || !writable(config)) {
    return;
  }

  const write = config.writeQueue.then(() => writePatches(config, patches));
  config.writeQueue = write.catch(() => undefined);
  await write;
}

async function writePatches(config: HeadscaleConfigState, patches: PatchConfig[]) {
  if (!config.path || !config.document) return;

  log.debug("config", "Patching Headscale configuration");
  for (const patch of patches) {
    const { path, value } = patch;
    log.debug("config", "Patching %s with %o", path, value);

    const key = splitPatchPath(path);
    if (value === null) {
      config.document.deleteIn(key);
      continue;
    }

    config.document.setIn(key, value);
  }

  log.debug("config", "Writing updated Headscale configuration to %s", config.path);
  await writeFile(config.path, config.document.toString(), "utf8");
  config.config = config.document.toJSON();
}

function splitPatchPath(path: string) {
  const key = [];
  let current = "";
  let quote = false;

  for (const char of path) {
    if (char === '"') {
      quote = !quote;
      continue;
    }

    if (char === "." && !quote) {
      key.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  key.push(current);
  return key;
}

async function addDNS(config: HeadscaleConfigState, record: DNSRecord) {
  if (config.dns) {
    if (!config.dns.readable() || !config.dns.writable()) {
      log.debug("config", "DNS config is not writable");
      return;
    }

    const records = config.dns.r;
    if (records.some((i) => i.name === record.name && i.type === record.type)) {
      log.debug("config", "DNS record already exists");
      return;
    }

    return config.dns.patch([...records, record]);
  }

  const existing = dnsRecords(config);
  if (existing.some((i) => i.name === record.name && i.type === record.type)) {
    log.debug("config", "DNS record already exists");
    return;
  }

  await patchHeadscaleConfig(config, [
    {
      path: "dns.extra_records",
      value: [...existing, record],
    },
  ]);

  return true;
}

async function removeDNS(config: HeadscaleConfigState, record: DNSRecord) {
  if (config.dns) {
    if (!config.dns.readable() || !config.dns.writable()) {
      log.debug("config", "DNS config is not writable");
      return;
    }

    const records = config.dns.r.filter((i) => i.name !== record.name || i.type !== record.type);
    return config.dns.patch(records);
  }

  const existing = dnsRecords(config);
  const filtered = existing.filter((i) => i.name !== record.name || i.type !== record.type);
  if (existing.length === filtered.length) {
    return;
  }

  await patchHeadscaleConfig(config, [
    {
      path: "dns.extra_records",
      value: filtered,
    },
  ]);

  return true;
}

export async function loadHeadscaleConfig(path?: string, dnsPath?: string) {
  if (!path) {
    log.debug("config", "No Headscale configuration file was provided");
    return createHeadscaleConfig("no");
  }

  log.debug("config", "Loading Headscale configuration file: %s", path);
  const { r, w } = await validateConfigPath(path);
  if (!r) {
    return createHeadscaleConfig("no");
  }

  const document = await loadConfigFile(path);
  if (!document) {
    return createHeadscaleConfig("no");
  }

  const rawConfig = document.toJSON();
  const parsedConfig = v.parse(headscaleConfigSchema, rawConfig);
  const conflict = v.safeParse(extraRecordsConflictSchema, rawConfig);
  const extraRecordsPath = parsedConfig.dns.extra_records_path;

  if (conflict.success && conflict.output.dns?.extra_records && extraRecordsPath) {
    log.warn(
      "config",
      "Both dns.extra_records and dns.extra_records_path are set; Headplane will use the JSON records file",
    );
  }

  const dns = await loadHeadscaleDNS(dnsPath ?? extraRecordsPath);
  if (dns && !extraRecordsPath) {
    log.error(
      "config",
      "Using separate DNS config file but dns.extra_records_path is not set in Headscale config",
    );
    log.error("config", "Please set `dns.extra_records_path` in the Headscale config");
    log.error("config", "Or remove `headscale.dns_records_path` from the Headplane config");

    exit(1);
  }

  return createHeadscaleConfig(w ? "rw" : "ro", dns, document, path);
}

async function validateConfigPath(path: string) {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    log.info("config", "Found a valid Headscale configuration file at %s", path);
  } catch (error) {
    log.error("config", "Unable to read a Headscale configuration file at %s", path);
    log.error("config", "%s", error);
    return { w: false, r: false };
  }

  try {
    await access(path, constants.F_OK | constants.W_OK);
    return { w: true, r: true };
  } catch {
    log.warn("config", "Headscale configuration file at %s is not writable", path);
    return { w: false, r: true };
  }
}

async function loadConfigFile(path: string) {
  log.debug("config", "Reading Headscale configuration file at %s", path);
  try {
    const data = await readFile(path, "utf8");
    const configYaml = parseDocument(data);
    if (configYaml.errors.length > 0) {
      log.error("config", "Cannot parse Headscale configuration file at %s", path);
      for (const error of configYaml.errors) {
        log.error("config", ` - ${error.toString()}`);
      }

      return false;
    }

    return configYaml;
  } catch (e) {
    log.error("config", "Error reading Headscale configuration file at %s", path);
    log.error("config", "%s", e);
    return false;
  }
}
