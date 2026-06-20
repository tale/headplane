import { data } from "react-router";

import {
  authContext,
  headscaleConfigContext,
  headscaleContext,
  integrationContext,
} from "~/server/context";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/overview";

export async function dnsAction({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const integration = context.get(integrationContext);

  const principal = await auth.require(request);
  const check = auth.can(principal, Capabilities.write_network);

  if (!check) {
    return data({ success: false }, 403);
  }

  if (!headscaleConfig.writable()) {
    return data({ success: false }, 403);
  }

  const formData = await request.formData();
  const action = formData.get("action_id")?.toString();
  if (!action) {
    return data({ success: false }, 400);
  }

  switch (action) {
    case "rename_tailnet": {
      const newName = formData.get("new_name")?.toString();
      if (!newName) {
        return data({ success: false }, 400);
      }

      await headscaleConfig.patch([
        {
          path: "dns.base_domain",
          value: newName,
        },
      ]);

      await integration?.onConfigChange(headscale);
      return { message: "Tailnet renamed successfully" };
    }
    case "toggle_magic": {
      const newState = formData.get("new_state")?.toString();
      if (!newState) {
        return data({ success: false }, 400);
      }

      await headscaleConfig.patch([
        {
          path: "dns.magic_dns",
          value: newState === "enabled",
        },
      ]);

      await integration?.onConfigChange(headscale);
      return { message: "Magic DNS state updated successfully" };
    }
    case "remove_ns": {
      const config = headscaleConfig.getDNSConfig();
      const ns = formData.get("ns")?.toString();
      const splitName = formData.get("split_name")?.toString();

      if (!ns || !splitName) {
        return data({ success: false }, 400);
      }

      if (splitName === "global") {
        const servers = config.nameservers.filter((i) => i !== ns);

        await headscaleConfig.patch([
          {
            path: "dns.nameservers.global",
            value: servers,
          },
        ]);
      } else {
        const splits = config.splitDns;
        const servers = splits[splitName].filter((i) => i !== ns);

        await headscaleConfig.patch([
          {
            path: `dns.nameservers.split."${splitName}"`,
            value: servers.length > 0 ? servers : null,
          },
        ]);
      }

      await integration?.onConfigChange(headscale);
      return { message: "Nameserver removed successfully" };
    }
    case "add_ns": {
      const config = headscaleConfig.getDNSConfig();
      const ns = formData.get("ns")?.toString();
      const splitName = formData.get("split_name")?.toString();

      if (!ns || !splitName) {
        return data({ success: false }, 400);
      }

      if (splitName === "global") {
        const servers = [...config.nameservers, ns];

        await headscaleConfig.patch([
          {
            path: "dns.nameservers.global",
            value: servers,
          },
        ]);
      } else {
        const splits = config.splitDns;
        const servers = [...(splits[splitName] ?? []), ns];

        await headscaleConfig.patch([
          {
            path: `dns.nameservers.split."${splitName}"`,
            value: servers,
          },
        ]);
      }

      await integration?.onConfigChange(headscale);
      return { message: "Nameserver added successfully" };
    }
    case "remove_domain": {
      const config = headscaleConfig.getDNSConfig();
      const domain = formData.get("domain")?.toString();
      if (!domain) {
        return data({ success: false }, 400);
      }

      const domains = config.searchDomains.filter((i) => i !== domain);
      await headscaleConfig.patch([
        {
          path: "dns.search_domains",
          value: domains,
        },
      ]);

      await integration?.onConfigChange(headscale);
      return { message: "Domain removed successfully" };
    }
    case "add_domain": {
      const config = headscaleConfig.getDNSConfig();
      const domain = formData.get("domain")?.toString();
      if (!domain) {
        return data({ success: false }, 400);
      }

      const domains = [...config.searchDomains, domain];

      await headscaleConfig.patch([
        {
          path: "dns.search_domains",
          value: domains,
        },
      ]);

      await integration?.onConfigChange(headscale);
      return { message: "Domain added successfully" };
    }
    case "remove_record": {
      const recordName = formData.get("record_name")?.toString();
      const recordType = formData.get("record_type")?.toString();

      if (!recordName || !recordType) {
        return data({ success: false }, 400);
      }

      // Value is not needed for removal
      const restart = await headscaleConfig.removeDNS({
        name: recordName,
        type: recordType,
        value: "",
      });

      if (!restart) {
        return;
      }

      await integration?.onConfigChange(headscale);
      return { message: "DNS record removed successfully" };
    }
    case "add_record": {
      const recordName = formData.get("record_name")?.toString();
      const recordType = formData.get("record_type")?.toString();
      const recordValue = formData.get("record_value")?.toString();

      if (!recordName || !recordType || !recordValue) {
        return data({ success: false }, 400);
      }

      const restart = await headscaleConfig.addDNS({
        name: recordName,
        type: recordType,
        value: recordValue,
      });

      if (!restart) {
        return;
      }

      await integration?.onConfigChange(headscale);
      return { message: "DNS record added successfully" };
    }
    case "override_dns": {
      const override = formData.get("override_dns")?.toString();
      if (!override) {
        return data({ success: false }, 400);
      }

      const overrideValue = override === "true";
      await headscaleConfig.patch([
        {
          path: "dns.override_local_dns",
          value: overrideValue,
        },
      ]);

      await integration?.onConfigChange(headscale);
      return { message: "DNS override updated successfully" };
    }
    default:
      return data({ success: false }, 400);
  }
}
