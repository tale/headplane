import {
  authContext,
  headscaleConfigContext,
  headscaleContext,
  integrationContext,
} from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { invalid, ok, parseForm } from "~/utils/form";

import type { Route } from "./+types/overview";
import { dnsAction as dnsActionSchema } from "./schemas";

export async function dnsAction({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const integration = context.get(integrationContext);

  await auth.requireCapability(request, Capabilities.write_network);
  if (!headscaleConfig.writable()) {
    return invalid({ form: "The Headscale configuration is read-only." }, 403);
  }

  const form = await parseForm(request, dnsActionSchema);
  if (!form.ok) {
    return invalid(form.errors);
  }

  const input = form.data;
  const config = headscaleConfig.getDNSConfig();
  const nameserverPath = (split?: string) =>
    split ? `dns.nameservers.split."${split}"` : "dns.nameservers.global";

  switch (input.intent) {
    case "rename_tailnet":
      await headscaleConfig.patch([{ path: "dns.base_domain", value: input.name }]);
      await integration?.onConfigChange(headscale);
      return ok("Tailnet renamed");

    case "toggle_magic": {
      const isEnabled = input.enabled === "true";
      await headscaleConfig.patch([{ path: "dns.magic_dns", value: isEnabled }]);
      await integration?.onConfigChange(headscale);
      return ok(isEnabled ? "Magic DNS enabled" : "Magic DNS disabled");
    }

    case "override_dns":
      await headscaleConfig.patch([
        { path: "dns.override_local_dns", value: input.enabled === "true" },
      ]);
      await integration?.onConfigChange(headscale);
      return ok("DNS override updated");

    case "add_ns": {
      const servers = input.split_domain
        ? (config.splitDns[input.split_domain] ?? [])
        : config.nameservers;
      if (servers.includes(input.nameserver)) {
        return invalid({ nameserver: "This nameserver is already in the list." });
      }

      await headscaleConfig.patch([
        { path: nameserverPath(input.split_domain), value: [...servers, input.nameserver] },
      ]);
      await integration?.onConfigChange(headscale);
      return ok("Nameserver added");
    }

    case "remove_ns": {
      const servers = (
        input.split_domain ? (config.splitDns[input.split_domain] ?? []) : config.nameservers
      ).filter((server) => server !== input.nameserver);

      // An empty split list is dropped so Headscale doesn't keep the domain.
      await headscaleConfig.patch([
        {
          path: nameserverPath(input.split_domain),
          value: input.split_domain && servers.length === 0 ? null : servers,
        },
      ]);
      await integration?.onConfigChange(headscale);
      return ok("Nameserver removed");
    }

    case "add_domain":
      if (config.searchDomains.includes(input.domain)) {
        return invalid({ domain: "This search domain is already in the list." });
      }

      await headscaleConfig.patch([
        { path: "dns.search_domains", value: [...config.searchDomains, input.domain] },
      ]);
      await integration?.onConfigChange(headscale);
      return ok("Search domain added");

    case "remove_domain":
      await headscaleConfig.patch([
        {
          path: "dns.search_domains",
          value: config.searchDomains.filter((domain) => domain !== input.domain),
        },
      ]);
      await integration?.onConfigChange(headscale);
      return ok("Search domain removed");

    case "add_record": {
      const record = { name: input.name, type: input.type, value: input.value };
      if (config.extraRecords.some((r) => r.name === record.name && r.type === record.type)) {
        return invalid({ name: `This domain already has an ${record.type} record.` });
      }

      // A separate records file is watched by Headscale, so only records in
      // the main config need a restart.
      if (await headscaleConfig.addDNS(record)) {
        await integration?.onConfigChange(headscale);
      }

      return ok("Record added");
    }

    case "remove_record":
      if (await headscaleConfig.removeDNS({ name: input.name, type: input.type, value: "" })) {
        await integration?.onConfigChange(headscale);
      }

      return ok("Record removed");
  }
}
