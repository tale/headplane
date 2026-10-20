import * as v from "valibot";

import {
  authContext,
  headscaleConfigContext,
  headscaleContext,
  integrationContext,
} from "~/server/context";
import { ActionError, createAction } from "~/server/web/actions";
import { Capabilities } from "~/server/web/roles";
import { invalid, ok, parseValues } from "~/utils/form";

import { moveItem } from "./reorder";
import { nameserver, recordValue } from "./schemas";

const text = (message: string) => v.pipe(v.string(), v.trim(), v.nonEmpty(message));
const toggle = v.picklist(["true", "false"]);

// Empty means the global nameservers rather than a split DNS domain.
const splitDomain = v.pipe(
  v.optional(v.string(), ""),
  v.trim(),
  v.transform((value) => value || undefined),
);

function nameserverPath(split?: string) {
  return split ? `dns.nameservers.split."${split}"` : "dns.nameservers.global";
}

export const dnsAction = createAction({
  capability: Capabilities.write_network,
  async setup({ request, context }) {
    const principal = await context.get(authContext).require(request);
    const headscale = context.get(headscaleContext);
    const config = context.get(headscaleConfigContext);
    const integration = context.get(integrationContext);
    if (!config.writable()) {
      throw new ActionError("The Headscale configuration is read-only.", 403);
    }

    return {
      principal,
      config,
      dns: config.getDNSConfig(),
      restart: async () => {
        if (integration && !(await integration.onConfigChange(headscale))) {
          throw new ActionError(
            "Saved, but Headscale didn't come back after restarting. Check its logs.",
            502,
          );
        }
      },
    };
  },
  intents: {
    rename_tailnet: {
      fields: { name: text("Enter a tailnet name.") },
      async handler(input, { config, restart }) {
        await config.patch([{ path: "dns.base_domain", value: input.name }]);
        await restart();
        return ok("Tailnet renamed");
      },
    },
    toggle_magic: {
      fields: { enabled: toggle },
      async handler(input, { config, restart }) {
        const isEnabled = input.enabled === "true";
        await config.patch([{ path: "dns.magic_dns", value: isEnabled }]);
        await restart();
        return ok(isEnabled ? "Magic DNS enabled" : "Magic DNS disabled");
      },
    },
    override_dns: {
      fields: { enabled: toggle },
      async handler(input, { config, dns, restart }) {
        const isEnabled = input.enabled === "true";
        // Headscale won't start overriding local DNS without a global nameserver.
        if (isEnabled && dns.nameservers.length === 0) {
          throw new ActionError("Add a global nameserver before overriding local DNS.");
        }

        await config.patch([{ path: "dns.override_local_dns", value: isEnabled }]);
        await restart();
        return ok("DNS override updated");
      },
    },
    add_ns: {
      fields: { nameserver, split_domain: splitDomain },
      async handler(input, { config, dns, restart }) {
        const servers = input.split_domain
          ? (dns.splitDns[input.split_domain] ?? [])
          : dns.nameservers;
        if (servers.includes(input.nameserver)) {
          return invalid({ nameserver: "This nameserver is already in the list." });
        }

        await config.patch([
          { path: nameserverPath(input.split_domain), value: [...servers, input.nameserver] },
        ]);
        await restart();
        return ok("Nameserver added");
      },
    },
    remove_ns: {
      fields: { nameserver: v.string(), split_domain: splitDomain },
      async handler(input, { config, dns, restart }) {
        const current = input.split_domain
          ? (dns.splitDns[input.split_domain] ?? [])
          : dns.nameservers;
        if (!current.includes(input.nameserver)) {
          throw new ActionError("This nameserver isn't in the list anymore.");
        }

        const servers = current.filter((server) => server !== input.nameserver);

        if (!input.split_domain && servers.length === 0 && dns.overrideDns) {
          throw new ActionError(
            "Overriding local DNS needs a global nameserver. Turn off the override first.",
          );
        }

        // An empty split list is dropped so Headscale doesn't keep the domain.
        await config.patch([
          {
            path: nameserverPath(input.split_domain),
            value: input.split_domain && servers.length === 0 ? null : servers,
          },
        ]);
        await restart();
        return ok("Nameserver removed");
      },
    },
    move_ns: {
      fields: {
        nameserver: v.string(),
        split_domain: splitDomain,
        direction: v.picklist(["up", "down"]),
      },
      async handler(input, { config, dns, restart }) {
        const servers = input.split_domain
          ? (dns.splitDns[input.split_domain] ?? [])
          : dns.nameservers;
        if (!servers.includes(input.nameserver)) {
          throw new ActionError("This nameserver isn't in the list anymore.");
        }

        // moveItem hands back the same list when there's nowhere to move.
        const moved = moveItem(servers, input.nameserver, input.direction);
        if (moved === servers) {
          throw new ActionError(
            `This nameserver is already at the ${input.direction === "up" ? "top" : "bottom"}.`,
          );
        }

        await config.patch([{ path: nameserverPath(input.split_domain), value: moved }]);
        await restart();
        return ok();
      },
    },
    add_domain: {
      fields: { domain: text("Enter a search domain.") },
      async handler(input, { config, dns, restart }) {
        if (dns.searchDomains.includes(input.domain)) {
          return invalid({ domain: "This search domain is already in the list." });
        }

        await config.patch([
          { path: "dns.search_domains", value: [...dns.searchDomains, input.domain] },
        ]);
        await restart();
        return ok("Search domain added");
      },
    },
    remove_domain: {
      fields: { domain: v.string() },
      async handler(input, { config, dns, restart }) {
        if (!dns.searchDomains.includes(input.domain)) {
          throw new ActionError("This search domain isn't in the list anymore.");
        }

        await config.patch([
          {
            path: "dns.search_domains",
            value: dns.searchDomains.filter((domain) => domain !== input.domain),
          },
        ]);
        await restart();
        return ok("Search domain removed");
      },
    },
    move_domain: {
      fields: { domain: v.string(), direction: v.picklist(["up", "down"]) },
      async handler(input, { config, dns, restart }) {
        if (!dns.searchDomains.includes(input.domain)) {
          throw new ActionError("This search domain isn't in the list anymore.");
        }

        const moved = moveItem(dns.searchDomains, input.domain, input.direction);
        if (moved === dns.searchDomains) {
          throw new ActionError(
            `This search domain is already at the ${input.direction === "up" ? "top" : "bottom"}.`,
          );
        }

        await config.patch([{ path: "dns.search_domains", value: moved }]);
        await restart();
        return ok();
      },
    },
    add_record: {
      fields: {
        type: v.picklist(["A", "AAAA"], "Choose a record type."),
        name: text("Enter a domain."),
        value: v.string(),
      },
      async handler(input, { config, dns }) {
        if (!config.recordsWritable()) {
          throw new ActionError(
            "DNS records can only be changed through dns.extra_records_path.",
            403,
          );
        }

        const value = parseValues(recordValue[input.type], input.value);
        if (!value.ok) {
          return invalid({ value: value.errors.form });
        }

        if (dns.extraRecords.some((r) => r.name === input.name && r.type === input.type)) {
          return invalid({ name: `This domain already has an ${input.type} record.` });
        }

        await config.addDNS({ name: input.name, type: input.type, value: value.data });
        return ok("Record added");
      },
    },
    remove_record: {
      fields: { type: v.string(), name: v.string() },
      async handler(input, { config, dns }) {
        if (!config.recordsWritable()) {
          throw new ActionError(
            "DNS records can only be changed through dns.extra_records_path.",
            403,
          );
        }

        if (!dns.extraRecords.some((r) => r.name === input.name && r.type === input.type)) {
          throw new ActionError("This record isn't in the list anymore.");
        }

        await config.removeDNS({ name: input.name, type: input.type, value: "" });
        return ok("Record removed");
      },
    },
  },
});
