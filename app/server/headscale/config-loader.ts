import { constants, access, readFile, writeFile } from "node:fs/promises";
import { exit } from "node:process";
import { setTimeout } from "node:timers/promises";

import { Document, parseDocument } from "yaml";

import log from "~/utils/log";

import { DNSRecord, HeadscaleDNSConfig, loadHeadscaleDNS } from "./config-dns";

interface PatchConfig {
  path: string;
  value: unknown;
}

interface DNSConfigView {
  prefixes: {
    v4?: string;
    v6?: string;
    allocation: "sequential" | "random";
  };
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

// We need a class for the config because we need to be able to
// support retrieving it via a getter but also be able to
// patch it and to query it for its mode
class HeadscaleConfig {
  private document?: Document;
  private access: "rw" | "ro" | "no";
  private path?: string;
  private writeLock = false;
  private dns?: HeadscaleDNSConfig;

  constructor(
    access: "rw" | "ro" | "no",
    dns?: HeadscaleDNSConfig,
    document?: Document,
    path?: string,
  ) {
    this.access = access;
    this.document = document;
    this.path = path;
    this.dns = dns;
  }

  readable() {
    return this.access !== "no";
  }

  writable() {
    return this.access === "rw";
  }

  getDNSConfig(): DNSConfigView {
    const config = this.rawConfig();
    const prefixes = readObject(config, ["prefixes"]);
    const dns = readObject(config, ["dns"]);
    const nameservers = readObject(config, ["dns", "nameservers"]);

    return {
      prefixes: {
        v4: readString(prefixes?.v4),
        v6: readString(prefixes?.v6),
        allocation: prefixes?.allocation === "random" ? "random" : "sequential",
      },
      magicDns: readBoolean(dns?.magic_dns, true),
      baseDomain: readString(dns?.base_domain) ?? "",
      nameservers: readStringArray(nameservers?.global),
      splitDns: readStringArrayRecord(nameservers?.split),
      searchDomains: readStringArray(dns?.search_domains),
      overrideDns: readBoolean(dns?.override_local_dns, true),
      extraRecords: this.dnsRecords(),
    };
  }

  getMagicDNSBaseDomain() {
    if (!this.readable()) return;
    const dns = this.getDNSConfig();
    return dns.magicDns && dns.baseDomain ? dns.baseDomain : undefined;
  }

  getOIDCConfig(): OIDCConfigView | undefined {
    const oidc = readObject(this.rawConfig(), ["oidc"]);
    if (!oidc) return;
    const issuer = readString(oidc.issuer);
    if (!issuer) return;

    return {
      issuer,
      allowedDomains: readStringArray(oidc.allowed_domains),
      allowedGroups: readStringArray(oidc.allowed_groups),
      allowedUsers: readStringArray(oidc.allowed_users),
    };
  }

  hasOIDCConfig() {
    return this.getOIDCConfig() !== undefined;
  }

  dnsRecords() {
    if (this.dns) {
      return this.dns.r;
    }

    return readDNSRecords(readPath(this.rawConfig(), ["dns", "extra_records"]));
  }

  async patch(patches: PatchConfig[]) {
    if (!this.path || !this.document || !this.readable() || !this.writable()) {
      return;
    }

    log.debug("config", "Patching Headscale configuration");
    for (const patch of patches) {
      const { path, value } = patch;
      log.debug("config", "Patching %s with %o", path, value);

      // If the key is something like `test.bar."foo.bar"`, then we treat
      // the foo.bar as a single key, and not as two keys, so that needs
      // to be split correctly.

      // Iterate through each character, and if we find a dot, we check if
      // the next character is a quote, and if it is, we skip until the next
      // quote, and then we skip the next character, which should be a dot.
      // If it's not a quote, we split it.
      const key = [];
      let current = "";
      let quote = false;

      for (const char of path) {
        if (char === '"') {
          quote = !quote;
        }

        if (char === "." && !quote) {
          key.push(current);
          current = "";
          continue;
        }

        current += char;
      }

      key.push(current.replaceAll('"', ""));
      if (value === null) {
        this.document.deleteIn(key);
        continue;
      }

      this.document.setIn(key, value);
    }

    log.debug("config", "Writing updated Headscale configuration to %s", this.path);

    // We need to lock the writeLock so that we don't try to write
    // to the file while we're already writing to it
    while (this.writeLock) {
      await setTimeout(100);
    }

    this.writeLock = true;
    await writeFile(this.path, this.document.toString(), "utf8");
    this.writeLock = false;
    return;
  }

  /**
   * Adds a DNS record to the Headscale configuration.
   * Differentiates between the file mode and config mode automatically.
   * @param record The DNS record to add.
   * @returns True if we need to restart the integration.
   */
  async addDNS(record: DNSRecord) {
    if (this.dns) {
      if (!this.dns.readable() || !this.dns.writable()) {
        log.debug("config", "DNS config is not writable");
        return;
      }

      const records = this.dns.r;
      if (records.some((i) => i.name === record.name && i.type === record.type)) {
        log.debug("config", "DNS record already exists");
        return;
      }

      return this.dns.patch([...records, record]);
    }

    // If we get here, we need to add to the main config instead of
    // a separate file (which requires an integration restart)
    const existing = this.dnsRecords();
    if (existing.some((i) => i.name === record.name && i.type === record.type)) {
      log.debug("config", "DNS record already exists");
      return;
    }

    await this.patch([
      {
        path: "dns.extra_records",
        value: Array.from(new Set([...existing, record])),
      },
    ]);

    return true;
  }

  /**
   * Removes a DNS record from the Headscale configuration.
   * Differentiates between the file mode and config mode automatically.
   * @param records The DNS record to remove.
   * @returns True if we need to restart the integration.
   */
  async removeDNS(record: DNSRecord) {
    // In this case we need to check both the main config and the DNS config
    // to see if the record exists, and if it does, we need to remove it
    // from both places.

    if (this.dns) {
      if (!this.dns.readable() || !this.dns.writable()) {
        log.debug("config", "DNS config is not writable");
        return;
      }

      const records = this.dns.r.filter((i) => i.name !== record.name || i.type !== record.type);

      return this.dns.patch(records);
    }

    // If we get here, we need to remove from the main config instead of
    // a separate file (which requires an integration restart)
    const existing = this.dnsRecords();
    const filtered = existing.filter((i) => i.name !== record.name || i.type !== record.type);

    // If the length of the existing records is the same as the filtered
    // records, then we don't need to do anything
    if (existing.length === filtered.length) {
      return;
    }

    await this.patch([
      {
        path: "dns.extra_records",
        value: existing.filter((i) => i.name !== record.name || i.type !== record.type),
      },
    ]);

    return true;
  }

  private rawConfig() {
    return this.document?.toJSON() ?? {};
  }
}

export async function loadHeadscaleConfig(path?: string, strict = true, dnsPath?: string) {
  if (!path) {
    log.debug("config", "No Headscale configuration file was provided");
    return new HeadscaleConfig("no");
  }

  log.debug("config", "Loading Headscale configuration file: %s", path);
  const { r, w } = await validateConfigPath(path);
  if (!r) {
    return new HeadscaleConfig("no");
  }

  const document = await loadConfigFile(path);
  if (!document) {
    return new HeadscaleConfig("no");
  }

  if (!strict) {
    log.warn("config", "headscale.config_strict=false is no longer required for unknown keys");
    log.warn("config", "Headplane now validates only the Headscale config values it reads/writes");
  }

  const rawConfig = document.toJSON();
  const inlineExtraRecords = readPath(rawConfig, ["dns", "extra_records"]);
  const extraRecordsPath = readString(readPath(rawConfig, ["dns", "extra_records_path"]));

  if (Array.isArray(inlineExtraRecords) && extraRecordsPath) {
    log.warn("config", "Both extra_records and extra_records_path are set, Headscale will crash");

    log.warn("config", "Please remove one of them from the configuration file");
    return new HeadscaleConfig("no");
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

  return new HeadscaleConfig(w ? "rw" : "ro", dns, document, path);
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
  } catch (error) {
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

function readPath(config: unknown, path: string[]) {
  let current = config;
  for (const segment of path) {
    if (!isObject(current)) return;
    current = current[segment];
  }
  return current;
}

function readObject(config: unknown, path: string[]) {
  const value = readPath(config, path);
  return isObject(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readStringArrayRecord(value: unknown) {
  if (!isObject(value)) return {};

  const result: Record<string, string[]> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = readStringArray(item);
  }
  return result;
}

function readDNSRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DNSRecord => {
    if (!isObject(item)) return false;
    return (
      typeof item.name === "string" &&
      typeof item.type === "string" &&
      typeof item.value === "string"
    );
  });
}
