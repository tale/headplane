import { Info } from "lucide-react";
import { useFetcher } from "react-router";

import ActionDialog from "~/components/action-dialog";
import Button from "~/components/button";
import Callout from "~/components/callout";
import Link from "~/components/link";
import List from "~/components/list";
import Switch from "~/components/switch";
import Tooltip from "~/components/tooltip";
import type { ActionResult } from "~/utils/form";

import AddNS from "../dialogs/add-ns";

interface Props {
  nameservers: Record<string, string[]>;
  overrideLocalDns: boolean;
  isDisabled: boolean;
}

export default function ManageNS({ nameservers, isDisabled, overrideLocalDns }: Props) {
  const fetcher = useFetcher<ActionResult>();

  return (
    <div className="flex w-full flex-col sm:w-2/3">
      <h2 className="mb-4 text-lg font-semibold">Nameservers</h2>
      <p>
        Set the nameservers used by devices on the Tailnet to resolve DNS queries.{" "}
        <Link external styled to="https://tailscale.com/kb/1054/dns">
          Learn more
        </Link>
      </p>
      <div className="mt-4">
        {Object.keys(nameservers).map((key) => (
          <NameserverList
            fetcher={fetcher}
            isDisabled={isDisabled}
            isGlobal={key === "global"}
            key={key}
            name={key}
            nameservers={nameservers}
            overrideLocalDns={overrideLocalDns}
          />
        ))}

        {fetcher.data?.ok === false && (
          <Callout className="mb-4" variant="error">
            {fetcher.data.errors.form ?? "Couldn't update the DNS override."}
          </Callout>
        )}
        {isDisabled ? undefined : <AddNS />}
      </div>
    </div>
  );
}

interface ListProps {
  fetcher: ReturnType<typeof useFetcher<ActionResult>>;
  isGlobal: boolean;
  isDisabled: boolean;
  nameservers: Record<string, string[]>;
  overrideLocalDns: boolean;
  name: string;
}

function NameserverList({
  fetcher,
  isGlobal,
  isDisabled,
  nameservers,
  overrideLocalDns,
  name,
}: ListProps) {
  const list = isGlobal ? nameservers.global : nameservers[name];

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        {isGlobal ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-medium opacity-80">Global Nameservers</h2>
            <div className="flex items-center gap-2 text-sm">
              <Tooltip
                content={
                  <>
                    When enabled, use the DNS servers listed below to resolve names outside the
                    tailnet. When disabled (default), devices will prefer their local DNS
                    configuration.{" "}
                    <Link external styled to="https://tailscale.com/kb/1054/dns#global-nameservers">
                      Learn More
                    </Link>
                  </>
                }
              >
                <Info className="size-4" />
              </Tooltip>
              <p>Override DNS servers</p>
              <Switch
                className="h-[15px] w-[23px] p-0.5"
                defaultChecked={overrideLocalDns}
                label="Override local DNS settings"
                disabled={isDisabled}
                onCheckedChange={(checked) => {
                  fetcher.submit(
                    { intent: "override_dns", enabled: String(checked) },
                    { method: "POST" },
                  );
                }}
                switchClassName="h-[9px] w-[9px]"
              />
            </div>
          </div>
        ) : (
          <h2 className="font-medium opacity-80">{name}</h2>
        )}
      </div>
      <List>
        {list.length > 0
          ? list.map((ns) => (
              <List.Item key={ns}>
                <p className="font-mono text-sm">{ns}</p>
                <ActionDialog
                  description={
                    isGlobal
                      ? "Devices stop using this nameserver for queries outside the tailnet."
                      : `Devices stop using this nameserver for ${name}.`
                  }
                  fields={isGlobal ? { nameserver: ns } : { nameserver: ns, split_domain: name }}
                  intent="remove_ns"
                  isDestructive
                  submitLabel="Remove"
                  title={`Remove nameserver ${ns}?`}
                  trigger={
                    <Button
                      className="text-bad hover:bg-bad-subtle hover:text-bad"
                      disabled={isDisabled}
                      size="sm"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  }
                />
              </List.Item>
            ))
          : undefined}
      </List>
    </div>
  );
}
