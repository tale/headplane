import { Info } from "lucide-react";
import { Form, useSubmit } from "react-router";

import Button from "~/components/button";
import Link from "~/components/link";
import List from "~/components/list";
import Switch from "~/components/switch";
import Tooltip from "~/components/tooltip";

import AddNS from "../dialogs/add-ns";

interface Props {
  nameservers: Record<string, string[]>;
  overrideLocalDns: boolean;
  isDisabled: boolean;
}

export default function ManageNS({ nameservers, isDisabled, overrideLocalDns }: Props) {
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
            isDisabled={isDisabled}
            isGlobal={key === "global"}
            key={key}
            name={key}
            nameservers={nameservers}
            overrideLocalDns={overrideLocalDns}
          />
        ))}

        {isDisabled ? undefined : <AddNS nameservers={nameservers} />}
      </div>
    </div>
  );
}

interface ListProps {
  isGlobal: boolean;
  isDisabled: boolean;
  nameservers: Record<string, string[]>;
  overrideLocalDns: boolean;
  name: string;
}

function NameserverList({ isGlobal, isDisabled, nameservers, overrideLocalDns, name }: ListProps) {
  const list = isGlobal ? nameservers.global : nameservers[name];
  const submit = useSubmit();

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
                name="override_dns"
                onCheckedChange={(v) => {
                  submit(
                    {
                      action_id: "override_dns",
                      override_dns: v ? "true" : "false",
                    },
                    {
                      method: "POST",
                    },
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
                <Form method="POST">
                  <input name="action_id" type="hidden" value="remove_ns" />
                  <input name="ns" type="hidden" value={ns} />
                  <input name="split_name" type="hidden" value={isGlobal ? "global" : name} />
                  <Button
                    className="text-bad hover:bg-bad-subtle hover:text-bad"
                    size="sm"
                    variant="ghost"
                    disabled={isDisabled}
                    type="submit"
                  >
                    Remove
                  </Button>
                </Form>
              </List.Item>
            ))
          : undefined}
      </List>
    </div>
  );
}
